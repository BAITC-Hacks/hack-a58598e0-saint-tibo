from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends

from saint_tibo.auth.dependencies import require_permissions
from saint_tibo.auth.policy import Permission
from saint_tibo.auth.schemas import CurrentUser
from saint_tibo.core.errors import ErrorResponse
from saint_tibo.core.pagination import Page, Pagination
from saint_tibo.db.session import DatabaseSession
from saint_tibo.modules.processing import service
from saint_tibo.modules.processing.schemas import ProcessingJobCreate, ProcessingJobRead

ReadUser = Annotated[CurrentUser, Depends(require_permissions(Permission.MEETING_READ))]
WriteUser = Annotated[CurrentUser, Depends(require_permissions(Permission.MEETING_WRITE))]
router = APIRouter(
    prefix="/meetings/{meeting_id}/recordings/{recording_id}/jobs",
    tags=["processing"],
    responses={code: {"model": ErrorResponse} for code in (401, 403, 404, 409, 503)},
)


@router.post("", status_code=202, operation_id="createProcessingJob")
async def create_job(
    meeting_id: UUID,
    recording_id: UUID,
    body: ProcessingJobCreate,
    session: DatabaseSession,
    user: WriteUser,
) -> ProcessingJobRead:
    return ProcessingJobRead.model_validate(
        await service.create_job(session, user.id, meeting_id, recording_id, body)
    )


@router.get("", operation_id="listProcessingJobs")
async def list_jobs(
    meeting_id: UUID,
    recording_id: UUID,
    session: DatabaseSession,
    user: ReadUser,
    pagination: Pagination,
) -> Page[ProcessingJobRead]:
    rows, total = await service.list_jobs(session, user.id, meeting_id, recording_id, pagination)
    return Page(
        items=[ProcessingJobRead.model_validate(row) for row in rows],
        total=total,
        **pagination.model_dump(),
    )


@router.get("/{job_id}", operation_id="getProcessingJob")
async def get_job(
    meeting_id: UUID,
    recording_id: UUID,
    job_id: UUID,
    session: DatabaseSession,
    user: ReadUser,
) -> ProcessingJobRead:
    return ProcessingJobRead.model_validate(
        await service.get_job(session, user.id, meeting_id, recording_id, job_id)
    )
