import json
import logging
from datetime import UTC, datetime
from uuid import UUID, uuid4

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from saint_tibo.core.errors import APIError
from saint_tibo.core.pagination import PageParams, paginate
from saint_tibo.modules.meetings.models import Meeting, Participant, Recording
from saint_tibo.modules.meetings.service import meeting, not_found, recording
from saint_tibo.modules.processing.models import ProcessingJob
from saint_tibo.modules.results.models import ResultReview, ResultVersion, Segment
from saint_tibo.modules.results.schemas import (
    ReviewActionItemRead,
    ReviewMeeting,
    ReviewParticipant,
    ReviewRead,
    ReviewSummary,
    ReviewUpdate,
    TranscriptSegment,
)

logger = logging.getLogger(__name__)


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
    session: AsyncSession,
    owner_id: str,
    meeting_id: UUID,
    recording_id: UUID,
    version_id: UUID,
    *,
    lock: bool = False,
) -> ResultVersion:
    statement = (
        select(ResultVersion)
        .join(Recording, ResultVersion.recording_id == Recording.id)
        .join(Meeting, Recording.meeting_id == Meeting.id)
        .where(
            ResultVersion.id == version_id,
            ResultVersion.recording_id == recording_id,
            Meeting.id == meeting_id,
            Meeting.owner_id == owner_id,
        )
        .execution_options(populate_existing=True)
    )
    if lock:
        statement = statement.with_for_update(of=ResultVersion)
    row = await session.scalar(statement)
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


async def review_snapshot(
    session: AsyncSession, version: ResultVersion, revision: int
) -> ReviewRead | None:
    row = await session.get(ResultReview, (version.id, revision))
    return ReviewRead.model_validate(row.payload) if row is not None else None


async def initial_review(
    session: AsyncSession, version: ResultVersion, meeting_row: Meeting
) -> ReviewRead:
    participants = await session.scalars(
        select(Participant)
        .where(Participant.meeting_id == meeting_row.id)
        .order_by(Participant.created_at, Participant.id)
    )
    return ReviewRead(
        result_version_id=version.id,
        recording_id=version.recording_id,
        revision=version.revision,
        reviewed=False,
        is_incomplete=version.is_incomplete,
        saved_at=None,
        meeting=ReviewMeeting.model_validate(meeting_row),
        participants=[ReviewParticipant.model_validate(row) for row in participants],
        action_items=[],
        summary=ReviewSummary(),
    )


async def get_review(
    session: AsyncSession,
    owner_id: str,
    meeting_id: UUID,
    recording_id: UUID,
    version_id: UUID,
    revision: int | None = None,
) -> ReviewRead:
    version = await get_version(session, owner_id, meeting_id, recording_id, version_id)
    requested = version.revision if revision is None else revision
    snapshot = await review_snapshot(session, version, requested)
    if snapshot is not None:
        return snapshot
    if requested == version.revision == 1:
        meeting_row = await meeting(session, owner_id, meeting_id)
        return await initial_review(session, version, meeting_row)
    raise not_found()


async def update_review(
    session: AsyncSession,
    owner_id: str,
    meeting_id: UUID,
    recording_id: UUID,
    version_id: UUID,
    body: ReviewUpdate,
) -> ReviewRead:
    # Match DELETE/publish lock order and freeze the metadata for this revision.
    meeting_row = await meeting(session, owner_id, meeting_id, lock=True)
    await recording(session, owner_id, meeting_id, recording_id, lock=True)
    version = await get_version(session, owner_id, meeting_id, recording_id, version_id, lock=True)
    if body.revision != version.revision:
        raise APIError(409, "version_conflict", "Reload the latest revision before saving")
    previous = await review_snapshot(session, version, version.revision)
    summary = (
        body.summary
        if body.summary is not None
        else (previous.summary if previous is not None else ReviewSummary())
    )
    items = (
        [
            ReviewActionItemRead(**item.model_dump(), result_version_id=version.id)
            for item in body.action_items
        ]
        if body.action_items is not None
        else previous.action_items
        if previous is not None
        else []
    )
    participants = list(
        await session.scalars(
            select(Participant)
            .where(Participant.meeting_id == meeting_id)
            .order_by(Participant.created_at, Participant.id)
            .with_for_update()
        )
    )
    participant_ids = {row.id for row in participants}
    if any(
        item.assignee_participant_id is not None
        and item.assignee_participant_id not in participant_ids
        for item in items
    ):
        raise APIError(422, "invalid_assignee", "Assignee must belong to this meeting")
    source_ids = set(summary.source_segment_ids)
    for item in items:
        source_ids.update(item.source_segment_ids)
    if source_ids:
        found = set(
            await session.scalars(
                select(Segment.id).where(
                    Segment.result_version_id == version.id,
                    Segment.recording_id == recording_id,
                    Segment.id.in_(source_ids),
                )
            )
        )
        if found != source_ids:
            raise APIError(422, "invalid_source_segment", "Sources must belong to this result")

    content_changed = body.summary is not None or body.action_items is not None
    reviewed = (
        body.reviewed
        if body.reviewed is not None
        else (previous.reviewed if previous is not None and not content_changed else False)
    )
    snapshot = ReviewRead(
        result_version_id=version.id,
        recording_id=recording_id,
        revision=version.revision + 1,
        reviewed=reviewed,
        is_incomplete=version.is_incomplete,
        saved_at=datetime.now(UTC),
        meeting=ReviewMeeting.model_validate(meeting_row),
        participants=[ReviewParticipant.model_validate(row) for row in participants],
        action_items=items,
        summary=summary,
    )
    payload = snapshot.model_dump(mode="json")
    if len(json.dumps(payload, ensure_ascii=False).encode()) > 512 * 1024:
        raise APIError(422, "review_too_large", "Review exceeds the 512 KiB snapshot limit")
    session.add(
        ResultReview(result_version_id=version.id, revision=snapshot.revision, payload=payload)
    )
    version.revision = snapshot.revision
    version.status = "reviewed" if reviewed else "draft"
    # completed_stage remains transcribe: human review does not claim ML extraction.
    await session.commit()
    logger.info(
        "Saved result review result_version_id=%s revision=%s reviewed=%s",
        version_id,
        snapshot.revision,
        reviewed,
    )
    return snapshot


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
