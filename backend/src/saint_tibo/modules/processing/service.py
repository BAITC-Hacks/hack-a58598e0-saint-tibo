from uuid import UUID

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from saint_tibo.core.errors import APIError
from saint_tibo.core.pagination import PageParams, paginate
from saint_tibo.modules.meetings.service import not_found, recording
from saint_tibo.modules.processing.models import ProcessingJob
from saint_tibo.modules.processing.schemas import ProcessingJobCreate


async def interrupt_expired(session: AsyncSession, recording_id: UUID | None = None) -> None:
    statement = update(ProcessingJob).where(
        ProcessingJob.status == "running", ProcessingJob.lease_expires_at <= func.now()
    )
    if recording_id is not None:
        statement = statement.where(ProcessingJob.recording_id == recording_id)
    await session.execute(
        statement.values(
            status="interrupted",
            error_code="worker_lease_expired",
            finished_at=func.now(),
            claim_token=None,
            lease_expires_at=None,
        )
    )


async def create_job(
    session: AsyncSession,
    owner_id: str,
    meeting_id: UUID,
    recording_id: UUID,
    body: ProcessingJobCreate,
) -> ProcessingJob:
    # Serializes intent/retry creation with upload/finalize/delete for this recording.
    media = await recording(session, owner_id, meeting_id, recording_id, lock=True)
    await interrupt_expired(session, recording_id)
    existing = await session.scalar(
        select(ProcessingJob).where(
            ProcessingJob.recording_id == recording_id,
            ProcessingJob.request_key == body.request_key,
        )
    )
    if existing is not None:
        if any(getattr(existing, key) != value for key, value in body.model_dump().items()):
            raise APIError(
                409, "idempotency_conflict", "Request key was used with different options"
            )
        await session.commit()
        await session.refresh(existing)
        return existing
    if media.status not in ("ready", "incomplete") or media.media_size_bytes is None:
        raise APIError(409, "recording_not_playable", "Finish a playable recording first")
    if media.status == "incomplete" and not body.allow_incomplete:
        raise APIError(409, "incomplete_recording", "Explicitly allow processing incomplete audio")
    if body.retry_of_job_id is not None:
        previous = await session.scalar(
            select(ProcessingJob).where(
                ProcessingJob.id == body.retry_of_job_id,
                ProcessingJob.recording_id == recording_id,
            )
        )
        if previous is None:
            raise not_found()
        if previous.status not in ("failed", "interrupted"):
            raise APIError(
                409, "job_not_retryable", "Only failed or interrupted jobs can be retried"
            )
    active = await session.scalar(
        select(ProcessingJob.id).where(
            ProcessingJob.recording_id == recording_id,
            ProcessingJob.status.in_(("queued", "running")),
        )
    )
    if active is not None:
        raise APIError(409, "processing_in_progress", "This recording already has an active job")
    attempt = await session.scalar(
        select(func.max(ProcessingJob.attempt)).where(ProcessingJob.recording_id == recording_id)
    )
    row = ProcessingJob(recording_id=recording_id, attempt=(attempt or 0) + 1, **body.model_dump())
    session.add(row)
    await session.commit()
    await session.refresh(row)
    return row


async def list_jobs(
    session: AsyncSession,
    owner_id: str,
    meeting_id: UUID,
    recording_id: UUID,
    params: PageParams,
) -> tuple[list[ProcessingJob], int]:
    await recording(session, owner_id, meeting_id, recording_id)
    await interrupt_expired(session, recording_id)
    await session.commit()
    rows, total = await paginate(
        session,
        select(ProcessingJob)
        .where(ProcessingJob.recording_id == recording_id)
        .order_by(ProcessingJob.created_at.desc(), ProcessingJob.id.desc()),
        params,
    )
    return list(rows), total


async def get_job(
    session: AsyncSession, owner_id: str, meeting_id: UUID, recording_id: UUID, job_id: UUID
) -> ProcessingJob:
    await recording(session, owner_id, meeting_id, recording_id)
    await interrupt_expired(session, recording_id)
    await session.commit()
    row = await session.scalar(
        select(ProcessingJob).where(
            ProcessingJob.id == job_id, ProcessingJob.recording_id == recording_id
        )
    )
    if row is None:
        raise not_found()
    return row
