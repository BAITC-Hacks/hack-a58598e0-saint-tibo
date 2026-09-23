"""Owner-protected extraction action for an existing result version."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends

from saint_tibo.auth.dependencies import require_permissions
from saint_tibo.auth.policy import Permission
from saint_tibo.auth.schemas import CurrentUser
from saint_tibo.core.errors import ErrorResponse
from saint_tibo.db.session import DatabaseSession
from saint_tibo.modules.results.schemas import ReviewRead

from .service import extract_existing

WriteUser = Annotated[CurrentUser, Depends(require_permissions(Permission.MEETING_WRITE))]
router = APIRouter(
    prefix="/meetings/{meeting_id}/recordings/{recording_id}/results",
    tags=["results"],
    responses={code: {"model": ErrorResponse} for code in (401, 403, 404, 409, 503)},
)


@router.post("/{result_version_id}/extract", operation_id="extractResultDraft")
async def extract_result(
    meeting_id: UUID,
    recording_id: UUID,
    result_version_id: UUID,
    session: DatabaseSession,
    user: WriteUser,
) -> ReviewRead:
    """Send saved transcript text to the configured provider; save an unreviewed draft."""
    return await extract_existing(session, user.id, meeting_id, recording_id, result_version_id)
