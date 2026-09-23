import json
import logging
from collections.abc import Sequence
from datetime import UTC, datetime
from uuid import UUID, uuid4

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from saint_tibo.core.errors import APIError
from saint_tibo.core.pagination import PageParams, paginate
from saint_tibo.modules.meetings.models import Meeting, Participant, Recording
from saint_tibo.modules.meetings.service import meeting, not_found, recording
from saint_tibo.modules.processing.diarization import DiarizationOutput
from saint_tibo.modules.processing.models import ProcessingJob
from saint_tibo.modules.results.models import ResultReview, ResultVersion, Segment
from saint_tibo.modules.results.schemas import (
    ExtractionDraft,
    DiarizationData,
    DiarizationProvenance,
    DiarizationRead,
    DiarizationSpeaker,
    DiarizationTurn,
    ReviewActionItemRead,
    ReviewMeeting,
    ReviewParticipant,
    ReviewRead,
    ReviewSpeakerAssignment,
    ReviewSpeakerRead,
    ReviewSummary,
    ReviewUpdate,
    TranscriptSegment,
)

logger = logging.getLogger(__name__)


def speaker_data(output: DiarizationOutput) -> DiarizationData:
    ids = {label: uuid4() for label in dict.fromkeys(turn.speaker_label for turn in output.turns)}
    return DiarizationData(
        duration_ms=output.provenance.duration_ms,
        speakers=[DiarizationSpeaker(speaker_id=value, label=key) for key, value in ids.items()],
        turns=[
            DiarizationTurn(
                speaker_id=ids[turn.speaker_label], start_ms=turn.start_ms, end_ms=turn.end_ms
            )
            for turn in output.turns
        ],
        provenance=DiarizationProvenance.model_validate(
            output.provenance.model_dump(
                include={
                    "bundle_id",
                    "sherpa_onnx_version",
                    "model_sha256",
                    "requested_num_speakers",
                    "cluster_threshold",
                }
            )
        ),
    )


def segment_speakers(
    segments: list[TranscriptSegment],
    data: DiarizationData,
) -> dict[int, UUID | None]:
    """Keep a sentence unknown whenever its interval intersects multiple voices."""
    assignments: dict[int, UUID | None] = {}
    active: list[DiarizationTurn] = []
    cursor = 0
    for index, segment in sorted(enumerate(segments), key=lambda item: item[1].start_ms):
        while cursor < len(data.turns) and data.turns[cursor].start_ms < segment.end_ms:
            active.append(data.turns[cursor])
            cursor += 1
        active = [turn for turn in active if turn.end_ms > segment.start_ms]
        overlapping = {turn.speaker_id for turn in active if turn.start_ms < segment.end_ms}
        assignments[index] = next(iter(overlapping)) if len(overlapping) == 1 else None
    return assignments


def default_speakers(version: ResultVersion) -> list[ReviewSpeakerRead]:
    if version.diarization is None:
        return []
    data = DiarizationData.model_validate(version.diarization)
    return [ReviewSpeakerRead(speaker_id=row.speaker_id, label=row.label) for row in data.speakers]


def reviewed_speakers(
    version: ResultVersion,
    assignments: Sequence[ReviewSpeakerAssignment],
    participant_ids: set[UUID],
) -> list[ReviewSpeakerRead]:
    speakers = {row.speaker_id: row for row in default_speakers(version)}
    for assignment in assignments:
        if assignment.speaker_id not in speakers:
            raise APIError(422, "invalid_speaker", "Speaker must belong to this result")
        speakers[assignment.speaker_id] = ReviewSpeakerRead(
            **assignment.model_dump(exclude={"label"}), label=speakers[assignment.speaker_id].label
        )
    for speaker in speakers.values():
        if speaker.participant_id is not None and speaker.participant_id not in participant_ids:
            raise APIError(
                422, "invalid_speaker_participant", "Participant must belong to this meeting"
            )
        if speaker.merged_into_speaker_id is not None:
            target = speakers.get(speaker.merged_into_speaker_id)
            if (
                target is None
                or target.speaker_id == speaker.speaker_id
                or target.merged_into_speaker_id is not None
                or speaker.participant_id is not None
            ):
                raise APIError(
                    422, "invalid_speaker_merge", "Merge into a distinct canonical speaker"
                )
    return list(speakers.values())


async def publish_transcript(
    session: AsyncSession,
    job: ProcessingJob,
    segments: list[TranscriptSegment],
    language: str,
    duration_ms: int,
    *,
    segment_ids: list[UUID] | None = None,
    extraction_draft: ExtractionDraft | None = None,
    model_id: str,
    model_revision: str,
    diarization: DiarizationOutput | None = None,
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
    segment_ids = segment_ids if segment_ids is not None else [uuid4() for _ in segments]
    if len(segment_ids) != len(segments) or len(set(segment_ids)) != len(segment_ids):
        raise APIError(422, "invalid_source_segment", "Segment IDs must be distinct")
    if (current.target_stage == "extract") != (extraction_draft is not None):
        raise APIError(422, "invalid_extraction_output", "Requested stage did not finish")
    draft_payload = None
    if extraction_draft is not None:
        sources = set(extraction_draft.summary.source_segment_ids)
        for item in extraction_draft.action_items:
            sources.update(item.source_segment_ids)
            if not item.source_segment_ids or item.assignee_participant_id is not None:
                raise APIError(422, "invalid_extraction_output", "Invalid draft attribution")
            if item.due_date is not None or item.status != "open":
                raise APIError(422, "invalid_extraction_output", "Invalid draft status or date")
        if not sources <= set(segment_ids):
            raise APIError(422, "invalid_source_segment", "Sources must belong to this result")
        draft_payload = extraction_draft.model_dump(mode="json")
        if len(json.dumps(draft_payload, ensure_ascii=False).encode()) > 512 * 1024:
            raise APIError(422, "review_too_large", "Draft exceeds the snapshot limit")
    if (current.target_stage in ("diarize", "extract")) != (diarization is not None):
        raise APIError(
            422, "invalid_diarization_output", "Diarization does not match the requested stage"
        )
    data = speaker_data(diarization) if diarization is not None else None
    if data is not None and data.duration_ms != duration_ms:
        raise APIError(
            422, "invalid_diarization_output", "Diarization differs from the recording clock"
        )
    assignments = segment_speakers(segments, data) if data is not None else {}
    version_id = uuid4()
    session.add(
        ResultVersion(
            id=version_id,
            recording_id=media.id,
            job_id=job.id,
            is_incomplete=media.status == "incomplete",
            language=language,
            duration_ms=duration_ms,
            model_id=model_id,
            model_revision=model_revision,
            segment_count=len(segments),
            completed_stage=current.target_stage,
            extraction_draft=draft_payload,
            diarization=data.model_dump(mode="json") if data is not None else None,
        )
    )
    await session.flush()
    session.add_all(
        [
            Segment(
                id=segment_ids[index],
                result_version_id=version_id,
                recording_id=media.id,
                speaker_id=assignments.get(index),
                **row.model_dump(),
            )
            for index, row in enumerate(segments)
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


async def get_diarization(
    session: AsyncSession,
    owner_id: str,
    meeting_id: UUID,
    recording_id: UUID,
    version_id: UUID,
) -> DiarizationRead:
    version = await get_version(session, owner_id, meeting_id, recording_id, version_id)
    if version.diarization is None:
        raise APIError(409, "diarization_not_available", "This result has no speaker diarization")
    return DiarizationRead(
        result_version_id=version.id, recording_id=recording_id, **version.diarization
    )


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
    draft = (ExtractionDraft.model_validate(version.extraction_draft)
             if version.extraction_draft is not None else None)
    return ReviewRead(
        extraction_provenance=draft.provenance if draft is not None else None,
        result_version_id=version.id,
        recording_id=version.recording_id,
        revision=1,
        reviewed=False,
        is_incomplete=version.is_incomplete,
        saved_at=None,
        meeting=ReviewMeeting.model_validate(meeting_row),
        participants=[ReviewParticipant.model_validate(row) for row in participants],
        action_items=[
            ReviewActionItemRead(**item.model_dump(), result_version_id=version.id)
            for item in draft.action_items
        ] if draft is not None else [],
        summary=draft.summary if draft is not None else ReviewSummary(),
        speakers=default_speakers(version),
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
    if requested == 1 and (version.revision == 1 or version.extraction_draft is not None):
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
    base = previous if previous is not None else await initial_review(session, version, meeting_row)
    summary = body.summary if body.summary is not None else base.summary
    items = (
        [
            ReviewActionItemRead(**item.model_dump(), result_version_id=version.id)
            for item in body.action_items
        ]
        if body.action_items is not None
        else base.action_items
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
    speakers = reviewed_speakers(
        version,
        body.speakers if body.speakers is not None else base.speakers,
        participant_ids,
    )
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

    content_changed = any(
        value is not None for value in (body.summary, body.action_items, body.speakers)
    )
    reviewed = (
        body.reviewed
        if body.reviewed is not None
        else (previous.reviewed if previous is not None and not content_changed else False)
    )
    snapshot = ReviewRead(
        extraction_provenance=base.extraction_provenance,
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
        speakers=speakers,
    )
    payload = snapshot.model_dump(mode="json")
    if len(json.dumps(payload, ensure_ascii=False).encode()) > 512 * 1024:
        raise APIError(422, "review_too_large", "Review exceeds the 512 KiB snapshot limit")
    session.add(
        ResultReview(result_version_id=version.id, revision=snapshot.revision, payload=payload)
    )
    version.revision = snapshot.revision
    version.status = "reviewed" if reviewed else "draft"
    # Human corrections do not change which model stages actually completed.
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
