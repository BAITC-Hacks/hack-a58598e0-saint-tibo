import zipfile
from datetime import UTC, date, datetime
from io import BytesIO
from uuid import uuid4

from saint_tibo.modules.exports.render import render_docx, render_pdf
from saint_tibo.modules.exports.schemas import (
    ActionItemStatus,
    ExportActionItem,
    ExportMeeting,
    ExportParticipant,
    ExportSummary,
    ProtocolExport,
)


def sample_payload() -> ProtocolExport:
    owner = ExportParticipant(id=uuid4(), display_name="Әсет Нұрлан", role="Куратор")
    engineer = ExportParticipant(id=uuid4(), display_name="Иван Петров", role=None)
    action = ExportActionItem(
        id=uuid4(),
        text="Дайындау қажет өндіріс көрсеткіштері бойынша есеп — подготовить отчёт",
        assignee_participant_id=engineer.id,
        due_text="келесі аптаға дейін",
        due_date=date(2026, 9, 30),
        status=ActionItemStatus.IN_PROGRESS,
    )
    unknown = ExportActionItem(
        id=uuid4(),
        text="Ұсыныс дайындау",
        assignee_text="жауаптысы белгісіз",
        status=ActionItemStatus.OPEN,
    )
    return ProtocolExport(
        result_version_id=uuid4(),
        revision=2,
        meeting=ExportMeeting(
            title="Өндіріс көрсеткіштері — производственные показатели",
            started_at=datetime(2026, 9, 20, 8, 0, tzinfo=UTC),
            timezone="Asia/Almaty",
        ),
        participants=[owner, engineer],
        action_items=[action, unknown],
        summary=ExportSummary(
            topics=["Қауіпсіздік және өндіріс", "Сроки поставщиков"],
            decisions=["Принят шаблон договора"],
            open_questions=["Бюджет келесі кездесуде"],
        ),
    )


def test_render_docx_contains_kazakh_and_cyrillic_text():
    data = render_docx(sample_payload())
    assert data[:2] == b"PK"
    with zipfile.ZipFile(BytesIO(data)) as archive:
        document_xml = archive.read("word/document.xml").decode("utf-8")
    for fragment in ("Әсет Нұрлан", "Дайындау қажет", "келесі аптаға дейін", "2026-09-30"):
        assert fragment in document_xml


def test_render_pdf_embeds_local_font_and_builds_pages():
    data = render_pdf(sample_payload())
    assert data[:5] == b"%PDF-"
    assert b"DejaVuSans" in data
    assert data.rstrip().endswith(b"%%EOF")
