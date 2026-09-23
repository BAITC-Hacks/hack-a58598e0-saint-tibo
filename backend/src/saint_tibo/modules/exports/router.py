import logging
from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Response
from reportlab.platypus.doctemplate import LayoutError
from starlette.concurrency import run_in_threadpool

from saint_tibo.auth.dependencies import require_permissions
from saint_tibo.auth.policy import Permission
from saint_tibo.auth.schemas import CurrentUser
from saint_tibo.core.errors import APIError, ErrorResponse
from saint_tibo.db.session import DatabaseSession
from saint_tibo.modules.exports import service
from saint_tibo.modules.exports.render import render_docx, render_pdf

logger = logging.getLogger(__name__)
ReadUser = Annotated[CurrentUser, Depends(require_permissions(Permission.MEETING_READ))]
PDF_TYPE = "application/pdf"
DOCX_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
router = APIRouter(
    prefix="/meetings/{meeting_id}/recordings/{recording_id}/results",
    tags=["exports"],
    responses={code: {"model": ErrorResponse} for code in (401, 403, 404, 409, 503)},
)


@router.get(
    "/{result_version_id}/export",
    operation_id="exportReviewedResult",
    response_class=Response,
    responses={
        200: {
            "content": {
                media_type: {"schema": {"type": "string", "format": "binary"}}
                for media_type in (PDF_TYPE, DOCX_TYPE)
            },
            "headers": {"Content-Disposition": {"schema": {"type": "string"}}},
        },
    },
)
async def export_result(
    meeting_id: UUID,
    recording_id: UUID,
    result_version_id: UUID,
    session: DatabaseSession,
    user: ReadUser,
    format: Literal["pdf", "docx"],
    revision: Annotated[int, Query(ge=1)],
) -> Response:
    """Download a specific saved, reviewed revision; requires authenticated owner access."""
    payload = await service.export_payload(
        session, user.id, meeting_id, recording_id, result_version_id, revision
    )
    try:
        content = await run_in_threadpool(render_pdf if format == "pdf" else render_docx, payload)
    except (LayoutError, ValueError):
        # Renderer exceptions may include user text; do not log or expose them.
        raise APIError(
            500, "export_failed", "The reviewed document could not be rendered"
        ) from None
    logger.info(
        "Exported result result_version_id=%s revision=%s format=%s",
        result_version_id,
        revision,
        format,
    )
    return Response(
        content,
        media_type=PDF_TYPE if format == "pdf" else DOCX_TYPE,
        headers={
            "Content-Disposition": (
                f'attachment; filename="protocol-{result_version_id}-r{revision}.{format}"'
            ),
            "Cache-Control": "private, no-store",
            "X-Content-Type-Options": "nosniff",
        },
    )
