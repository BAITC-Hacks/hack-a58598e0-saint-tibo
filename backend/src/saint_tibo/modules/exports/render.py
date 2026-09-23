"""Render a ProtocolExport payload to DOCX and PDF bytes.

Both renderers use the vendored DejaVu Sans fonts (assets/fonts/) —
Cyrillic and Kazakh letters stay readable without any CDN or system
font dependency.
"""

from io import BytesIO
from pathlib import Path
from typing import cast
from uuid import UUID
from zoneinfo import ZoneInfo

from docx import Document
from docx.document import Document as DocumentType
from docx.oxml import OxmlElement
from docx.shared import Mm, Pt
from docx.table import Table as DocxTable
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from saint_tibo.modules.exports.schemas import (
    ExportActionItem,
    ExportParticipant,
    ProtocolExport,
)
from saint_tibo.modules.results.schemas import ActionItemStatus

FONTS_DIR = Path(__file__).parent / "assets" / "fonts"
FONT_FAMILY = "DejaVuSans"

_STATUS_LABELS = {
    ActionItemStatus.OPEN: "Открыто",
    ActionItemStatus.IN_PROGRESS: "В работе",
    ActionItemStatus.DONE: "Выполнено",
    ActionItemStatus.CANCELLED: "Отменено",
}

_MISSING = "—"
_INCOMPLETE = "Неполная запись: протокол отражает только доступную часть совещания."


def _started_at_label(payload: ProtocolExport) -> str:
    local = payload.meeting.started_at.astimezone(ZoneInfo(payload.meeting.timezone))
    return f"{local:%d.%m.%Y %H:%M} ({payload.meeting.timezone})"


def _assignee_label(item: ExportActionItem, participants: dict[UUID, ExportParticipant]) -> str:
    if item.assignee_participant_id is not None:
        participant = participants.get(item.assignee_participant_id)
        if participant is not None:
            return participant.display_name
    return item.assignee_text or _MISSING


def _due_label(item: ExportActionItem) -> str:
    if item.due_date is not None:
        if item.due_text:
            return f"{item.due_date.isoformat()} ({item.due_text})"
        return item.due_date.isoformat()
    return item.due_text or _MISSING


def _action_item_rows(payload: ProtocolExport) -> list[list[str]]:
    participants = {p.id: p for p in payload.participants}
    return [
        [
            str(index),
            item.text,
            _assignee_label(item, participants),
            _due_label(item),
            _STATUS_LABELS.get(item.status, item.status.value),
        ]
        for index, item in enumerate(payload.action_items, start=1)
    ]


def _docx_table(
    document: DocumentType, headers: tuple[str, ...], widths: tuple[int, ...]
) -> DocxTable:
    table = cast(DocxTable, document.add_table(rows=1, cols=len(headers)))
    table.style = "Table Grid"
    table.autofit = False
    for column, width in zip(table.columns, widths, strict=True):
        column.width = Mm(width)
    for cell, title, width in zip(table.rows[0].cells, headers, widths, strict=True):
        cell.text = title
        cell.width = Mm(width)
    table.rows[0]._tr.get_or_add_trPr().append(OxmlElement("w:tblHeader"))
    return table


def render_docx(payload: ProtocolExport) -> bytes:
    document: DocumentType = Document()
    page = document.sections[0]
    page.page_width, page.page_height = Mm(210), Mm(297)
    page.left_margin = page.right_margin = Mm(15)
    page.top_margin = page.bottom_margin = Mm(15)
    normal = document.styles["Normal"]
    normal.font.name = FONT_FAMILY
    normal.font.size = Pt(10)

    document.add_heading("Протокол совещания", level=0)
    document.add_paragraph(payload.meeting.title)
    document.add_paragraph(f"Дата: {_started_at_label(payload)}")
    document.add_paragraph(
        f"Версия результата: {payload.result_version_id}, ревизия {payload.revision}"
    )
    if payload.is_incomplete:
        document.add_paragraph(_INCOMPLETE)

    document.add_heading("Участники", level=1)
    participants = _docx_table(document, ("Имя", "Роль"), (80, 100))
    for participant in payload.participants:
        cells = participants.add_row().cells  # type: ignore[no-untyped-call]
        cells[0].text = participant.display_name
        cells[1].text = participant.role or _MISSING

    if payload.summary is not None:
        document.add_heading("Саммари", level=1)
        for heading, entries in (
            ("Темы", payload.summary.topics),
            ("Решения", payload.summary.decisions),
            ("Открытые вопросы", payload.summary.open_questions),
        ):
            document.add_heading(heading, level=2)
            for entry in entries or [_MISSING]:
                document.add_paragraph(entry, style="List Bullet")

    document.add_heading("Поручения", level=1)
    items = _docx_table(
        document, ("№", "Поручение", "Ответственный", "Срок", "Статус"), (8, 84, 42, 26, 20)
    )
    for row in _action_item_rows(payload):
        for cell, value in zip(items.add_row().cells, row, strict=True):  # type: ignore[no-untyped-call]
            cell.text = value

    buffer = BytesIO()
    document.save(buffer)
    return buffer.getvalue()


def _register_fonts() -> None:
    pdfmetrics.registerFont(TTFont(FONT_FAMILY, str(FONTS_DIR / "DejaVuSans.ttf")))
    pdfmetrics.registerFont(TTFont(f"{FONT_FAMILY}-Bold", str(FONTS_DIR / "DejaVuSans-Bold.ttf")))


def render_pdf(payload: ProtocolExport) -> bytes:
    _register_fonts()
    base = ParagraphStyle("Base", fontName=FONT_FAMILY, fontSize=9, leading=12)
    heading = ParagraphStyle(
        "Heading",
        parent=base,
        fontName=f"{FONT_FAMILY}-Bold",
        fontSize=15,
        leading=19,
        spaceAfter=6,
    )
    section = ParagraphStyle(
        "Section",
        parent=base,
        fontName=f"{FONT_FAMILY}-Bold",
        fontSize=11,
        leading=14,
        spaceBefore=8,
        spaceAfter=4,
    )
    cell = ParagraphStyle("Cell", parent=base, fontSize=8, leading=10)

    def p(text: str, style: ParagraphStyle = cell) -> Paragraph:
        escaped = text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
        return Paragraph(escaped, style)

    story: list[object] = [
        Paragraph("Протокол совещания", heading),
        p(payload.meeting.title, base),
        p(f"Дата: {_started_at_label(payload)}", base),
        p(f"Версия результата: {payload.result_version_id}, ревизия {payload.revision}", base),
        Spacer(1, 4 * mm),
    ]
    if payload.is_incomplete:
        story.append(p(_INCOMPLETE, base))

    story.append(Paragraph("Участники", section))
    participant_rows = [[p("Имя"), p("Роль")]] + [
        [p(participant.display_name), p(participant.role or _MISSING)]
        for participant in payload.participants
    ]
    story.append(
        Table(
            participant_rows,
            colWidths=[80 * mm, 100 * mm],
            repeatRows=1,
            splitInRow=1,
            style=TableStyle(
                [
                    ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
                    ("BACKGROUND", (0, 0), (-1, 0), colors.lightgrey),
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ]
            ),
        )
    )

    if payload.summary is not None:
        story.append(Paragraph("Саммари", section))
        for title, entries in (
            ("Темы", payload.summary.topics),
            ("Решения", payload.summary.decisions),
            ("Открытые вопросы", payload.summary.open_questions),
        ):
            story.append(Paragraph(title, base))
            for entry in entries or [_MISSING]:
                story.append(p(f"• {entry}", base))

    story.append(Paragraph("Поручения", section))
    header = ["№", "Поручение", "Ответственный", "Срок", "Статус"]
    item_rows = [[p(column) for column in header]] + [
        [p(value) for value in row] for row in _action_item_rows(payload)
    ]
    story.append(
        Table(
            item_rows,
            colWidths=[8 * mm, 84 * mm, 42 * mm, 26 * mm, 20 * mm],
            repeatRows=1,
            splitInRow=1,
            style=TableStyle(
                [
                    ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
                    ("BACKGROUND", (0, 0), (-1, 0), colors.lightgrey),
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ]
            ),
        )
    )

    buffer = BytesIO()
    SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=15 * mm,
        rightMargin=15 * mm,
        topMargin=15 * mm,
        bottomMargin=15 * mm,
        title="Протокол совещания",
    ).build(story)
    return buffer.getvalue()
