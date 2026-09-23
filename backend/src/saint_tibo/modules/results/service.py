from uuid import UUID, uuid4

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from saint_tibo.core.errors import APIError
from saint_tibo.core.pagination import PageParams, paginate
from saint_tibo.modules.meetings.models import Meeting, Recording
from saint_tibo.modules.meetings.service import not_found, recording
from saint_tibo.modules.processing.models import ProcessingJob
from saint_tibo.modules.results.models import ResultVersion, Segment
from saint_tibo.modules.results.schemas import TranscriptSegment


async def publish_transcript(
    session: AsyncSession,
    job: ProcessingJob,
    segments: list[TranscriptSegment],
    language: str,
    duration_ms: int,
) -> UUID:
    # Same lock order as recording DELETE: recording first, job second. Inference
    # has finished before this transaction begins; no locks across model execution.
    media = await session.scalar(
        select(Recording).where(Recording.id == job.recording_id).with_for_update()
    )
    current = await session.scalar(
        select(ProcessingJob)
        .where(
            ProcessingJob.id == job.id,
            ProcessingJob.status == "running",
            ProcessingJob.claim_token == job.claim_token,
            ProcessingJob.lease_expires_at > func.now(),
        )
        .with_for_update()
    )
    if media is None or current is None:
        raise APIError(409, "processing_interrupted", "The processing lease is no longer valid")
    if media.duration_ms != duration_ms or any(row.end_ms > duration_ms for row in segments):
        raise APIError(
            422, "invalid_transcript_timing", "Transcript differs from the recording clock"
        )
    version_id = uuid4()
    session.add(
        ResultVersion(
            id=version_id,
            recording_id=media.id,
            job_id=job.id,
            is_incomplete=media.status == "incomplete",
            language=language,
            duration_ms=duration_ms,
            model_id="Systran/faster-whisper-small",
            model_revision="536b0662742c02347bc0e980a01041f333bce120",
            segment_count=len(segments),
        )
    )
    await session.flush()
    session.add_all(
        [
            Segment(result_version_id=version_id, recording_id=media.id, **row.model_dump())
            for row in segments
        ]
    )
    current.status = "succeeded"
    current.stage = "complete"
    current.progress = 1
    current.result_version_id = version_id
    current.finished_at = await session.scalar(select(func.now()))
    current.lease_expires_at = None
    current.claim_token = None
    await session.commit()
    return version_id


async def get_version(
    session: AsyncSession, owner_id: str, meeting_id: UUID, recording_id: UUID, version_id: UUID
) -> ResultVersion:
    row = await session.scalar(
        select(ResultVersion)
        .join(Recording, ResultVersion.recording_id == Recording.id)
        .join(Meeting, Recording.meeting_id == Meeting.id)
        .where(
            ResultVersion.id == version_id,
            ResultVersion.recording_id == recording_id,
            Meeting.id == meeting_id,
            Meeting.owner_id == owner_id,
        )
    )
    if row is None:
        raise not_found()
    return row


async def list_versions(
    session: AsyncSession, owner_id: str, meeting_id: UUID, recording_id: UUID, params: PageParams
) -> tuple[list[ResultVersion], int]:
    await recording(session, owner_id, meeting_id, recording_id)
    rows, total = await paginate(
        session,
        select(ResultVersion)
        .where(ResultVersion.recording_id == recording_id)
        .order_by(ResultVersion.created_at.desc(), ResultVersion.id.desc()),
        params,
    )
    return list(rows), total


async def list_segments(
    session: AsyncSession,
    owner_id: str,
    meeting_id: UUID,
    recording_id: UUID,
    version_id: UUID,
    params: PageParams,
) -> tuple[list[Segment], int]:
    await get_version(session, owner_id, meeting_id, recording_id, version_id)
    rows, total = await paginate(
        session,
        select(Segment)
        .where(Segment.result_version_id == version_id)
        .order_by(Segment.start_ms, Segment.id),
        params,
    )
    return list(rows), total
