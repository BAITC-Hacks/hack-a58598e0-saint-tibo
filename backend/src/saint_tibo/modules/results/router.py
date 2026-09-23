from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends

from saint_tibo.auth.dependencies import require_permissions
from saint_tibo.auth.policy import Permission
from saint_tibo.auth.schemas import CurrentUser
from saint_tibo.core.errors import ErrorResponse
from saint_tibo.core.pagination import Page, Pagination
from saint_tibo.db.session import DatabaseSession
from saint_tibo.modules.results import service
from saint_tibo.modules.results.schemas import ResultVersionRead, SegmentRead

ReadUser = Annotated[CurrentUser, Depends(require_permissions(Permission.MEETING_READ))]
router = APIRouter(
    prefix="/meetings/{meeting_id}/recordings/{recording_id}/results",
    tags=["results"],
    responses={code: {"model": ErrorResponse} for code in (401, 403, 404, 503)},
)


@router.get("", operation_id="listResultVersions")
async def list_versions(
    meeting_id: UUID,
    recording_id: UUID,
    session: DatabaseSession,
    user: ReadUser,
    pagination: Pagination,
) -> Page[ResultVersionRead]:
    rows, total = await service.list_versions(
        session, user.id, meeting_id, recording_id, pagination
    )
    return Page(
        items=[ResultVersionRead.model_validate(row) for row in rows],
        total=total,
        **pagination.model_dump(),
    )


@router.get("/{result_version_id}", operation_id="getResultVersion")
async def get_version(
    meeting_id: UUID,
    recording_id: UUID,
    result_version_id: UUID,
    session: DatabaseSession,
    user: ReadUser,
) -> ResultVersionRead:
    return ResultVersionRead.model_validate(
        await service.get_version(session, user.id, meeting_id, recording_id, result_version_id)
    )


@router.get("/{result_version_id}/segments", operation_id="listTranscriptSegments")
async def list_segments(
    meeting_id: UUID,
    recording_id: UUID,
    result_version_id: UUID,
    session: DatabaseSession,
    user: ReadUser,
    pagination: Pagination,
) -> Page[SegmentRead]:
    rows, total = await service.list_segments(
        session, user.id, meeting_id, recording_id, result_version_id, pagination
    )
    return Page(
        items=[SegmentRead.model_validate(row) for row in rows],
        total=total,
        **pagination.model_dump(),
    )
