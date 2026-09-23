"""Owner-scoped persistence and publication of validated recording files."""

import asyncio
import json
from datetime import UTC, datetime, timedelta
from email.message import Message
from pathlib import Path
from uuid import UUID

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from saint_tibo.core.config import Settings
from saint_tibo.core.errors import APIError
from saint_tibo.core.pagination import PageParams, paginate
from saint_tibo.modules.meetings import storage
from saint_tibo.modules.meetings.models import Meeting, Participant, Recording, RecordingChunk
from saint_tibo.modules.meetings.schemas import (
    MeetingCreate,
    MeetingUpdate,
    ParticipantCreate,
    ParticipantUpdate,
    RecordingCreate,
    RecordingFinalize,
)


def not_found() -> APIError:
    return APIError(404, "not_found", "Resource was not found")


async def meeting(
    session: AsyncSession, owner_id: str, meeting_id: UUID, *, lock: bool = False
) -> Meeting:
    statement = select(Meeting).where(Meeting.id == meeting_id, Meeting.owner_id == owner_id)
    if lock:
        statement = statement.with_for_update()
    row = await session.scalar(statement)
    if row is None:
        raise not_found()
    return row


async def list_meetings(
    session: AsyncSession, owner_id: str, params: PageParams
) -> tuple[list[Meeting], int]:
    rows, total = await paginate(
        session,
        select(Meeting)
        .where(Meeting.owner_id == owner_id)
        .order_by(Meeting.created_at.desc(), Meeting.id.desc()),
        params,
    )
    return list(rows), total


async def create_meeting(session: AsyncSession, owner_id: str, body: MeetingCreate) -> Meeting:
    row = Meeting(owner_id=owner_id, **body.model_dump())
    session.add(row)
    await session.commit()
    await session.refresh(row)
    return row


async def update_meeting(
    session: AsyncSession, owner_id: str, meeting_id: UUID, body: MeetingUpdate
) -> Meeting:
    row = await meeting(session, owner_id, meeting_id, lock=True)
    for key, value in body.changes().items():
        setattr(row, key, value)
    await session.commit()
    await session.refresh(row)
    return row


async def delete_meeting(
    session: AsyncSession, config: Settings, owner_id: str, meeting_id: UUID
) -> None:
    row = await meeting(session, owner_id, meeting_id, lock=True)
    recordings = list(
        await session.scalars(
            select(Recording)
            .where(Recording.meeting_id == row.id)
            .order_by(Recording.id)
            .with_for_update()
        )
    )
    # Remove files first. If cleanup fails, metadata remains so DELETE can be retried.
    # All future derivative files must live inside their recording directory.
    await remove_files(config, [record.id for record in recordings])
    await session.delete(row)
    await session.commit()


async def list_participants(
    session: AsyncSession, owner_id: str, meeting_id: UUID, params: PageParams
) -> tuple[list[Participant], int]:
    await meeting(session, owner_id, meeting_id)
    statement = (
        select(Participant)
        .join(Meeting)
        .where(Participant.meeting_id == meeting_id, Meeting.owner_id == owner_id)
        .order_by(Participant.created_at.desc(), Participant.id.desc())
    )
    rows, total = await paginate(session, statement, params)
    return list(rows), total


async def create_participant(
    session: AsyncSession, owner_id: str, meeting_id: UUID, body: ParticipantCreate
) -> Participant:
    await meeting(session, owner_id, meeting_id, lock=True)
    row = Participant(meeting_id=meeting_id, **body.model_dump())
    session.add(row)
    await session.commit()
    await session.refresh(row)
    return row


async def participant(
    session: AsyncSession, owner_id: str, meeting_id: UUID, participant_id: UUID
) -> Participant:
    row = await session.scalar(
        select(Participant)
        .join(Meeting)
        .where(
            Participant.id == participant_id,
            Participant.meeting_id == meeting_id,
            Meeting.owner_id == owner_id,
        )
        .with_for_update(of=Participant)
    )
    if row is None:
        raise not_found()
    return row


async def update_participant(
    session: AsyncSession,
    owner_id: str,
    meeting_id: UUID,
    participant_id: UUID,
    body: ParticipantUpdate,
) -> Participant:
    row = await participant(session, owner_id, meeting_id, participant_id)
    for key, value in body.changes().items():
        setattr(row, key, value)
    await session.commit()
    await session.refresh(row)
    return row


async def delete_participant(
    session: AsyncSession, owner_id: str, meeting_id: UUID, participant_id: UUID
) -> None:
    row = await participant(session, owner_id, meeting_id, participant_id)
    await session.delete(row)
    await session.commit()


async def recording(
    session: AsyncSession,
    owner_id: str,
    meeting_id: UUID,
    recording_id: UUID,
    *,
    lock: bool = False,
) -> Recording:
    statement = (
        select(Recording)
        .join(Meeting)
        .where(
            Recording.id == recording_id,
            Recording.meeting_id == meeting_id,
            Meeting.owner_id == owner_id,
        )
        .execution_options(populate_existing=True)
    )
    if lock:
        statement = statement.with_for_update(of=Recording)
    row = await session.scalar(statement)
    if row is None:
        raise not_found()
    return row


async def mark_stale(
    session: AsyncSession, config: Settings, owner_id: str, meeting_id: UUID
) -> None:
    cutoff = datetime.now(UTC) - timedelta(seconds=config.recording_stale_seconds)
    await session.execute(
        update(Recording)
        .where(
            Recording.meeting_id == meeting_id,
            Recording.meeting_id.in_(select(Meeting.id).where(Meeting.owner_id == owner_id)),
            Recording.status == "receiving",
            Recording.updated_at < cutoff,
        )
        .values(status="incomplete", error_code="recording_interrupted")
    )
    await session.commit()


async def list_recordings(
    session: AsyncSession, config: Settings, owner_id: str, meeting_id: UUID, params: PageParams
) -> tuple[list[Recording], int]:
    await meeting(session, owner_id, meeting_id)
    await mark_stale(session, config, owner_id, meeting_id)
    statement = (
        select(Recording)
        .join(Meeting)
        .where(Recording.meeting_id == meeting_id, Meeting.owner_id == owner_id)
        .order_by(Recording.created_at.desc(), Recording.id.desc())
    )
    rows, total = await paginate(session, statement, params)
    return list(rows), total


async def create_recording(
    session: AsyncSession, owner_id: str, meeting_id: UUID, body: RecordingCreate
) -> Recording:
    await meeting(session, owner_id, meeting_id, lock=True)
    row = Recording(meeting_id=meeting_id, **body.model_dump())
    session.add(row)
    await session.commit()
    await session.refresh(row)
    return row


def finalized(row: Recording) -> bool:
    return row.finalized_is_complete is not None


def ensure_receiving(row: Recording) -> None:
    if finalized(row) or row.status not in {"receiving", "incomplete"}:
        raise APIError(409, "recording_finalized", "Recording no longer accepts data")


async def fail_recording(
    session: AsyncSession,
    owner_id: str,
    meeting_id: UUID,
    recording_id: UUID,
    version: datetime,
    error: APIError,
) -> None:
    row = await recording(session, owner_id, meeting_id, recording_id, lock=True)
    if row.updated_at == version and not finalized(row):
        row.status = "failed"
        row.error_code = error.code
        await session.commit()
    else:
        await session.rollback()


async def publish_file(
    session: AsyncSession,
    config: Settings,
    owner_id: str,
    meeting_id: UUID,
    recording_id: UUID,
    received: storage.ReceivedFile,
) -> Recording:
    audio = None
    try:
        row = await recording(session, owner_id, meeting_id, recording_id)
        if row.source != "file":
            raise APIError(409, "source_mismatch", "This recording accepts live chunks")
        if finalized(row):
            if row.sha256 == received.sha256:
                return row
            raise APIError(409, "recording_finalized", "A different file is already stored")
        ensure_receiving(row)
        version = row.updated_at
        await session.commit()
        try:
            audio = await storage.normalize(
                received.path,
                config.recording_storage_path,
                config.recording_max_duration_ms,
                config.recording_media_timeout_seconds,
            )
        except APIError as exc:
            await fail_recording(session, owner_id, meeting_id, recording_id, version, exc)
            raise
        row = await recording(session, owner_id, meeting_id, recording_id, lock=True)
        if finalized(row):
            if row.sha256 == received.sha256:
                return row
            raise APIError(409, "recording_finalized", "A different file is already stored")
        ensure_receiving(row)
        publish(config, row, received, audio)
        row.status = "ready"
        row.finalized_is_complete = True
        row.error_code = None
        await session.commit()
        await session.refresh(row)
        return row
    finally:
        received.path.unlink(missing_ok=True)
        if audio is not None:
            audio.path.unlink(missing_ok=True)


def publish(
    config: Settings, row: Recording, received: storage.ReceivedFile, audio: storage.NormalizedAudio
) -> None:
    directory = storage.recording_dir(config.recording_storage_path, row.id)
    directory.mkdir(parents=True, exist_ok=True, mode=0o700)
    received.path.replace(directory / "original")
    audio.path.replace(directory / "media.wav")
    row.content_type = audio.source_content_type
    row.sha256 = received.sha256
    row.size_bytes = received.size_bytes
    row.duration_ms = audio.duration_ms
    row.media_size_bytes = audio.size_bytes


def chunk_path(config: Settings, row: RecordingChunk) -> Path:
    return (
        storage.recording_dir(config.recording_storage_path, row.recording_id)
        / "chunks"
        / f"{row.sequence}-{row.sha256}"
    )


def normalize_mime(content_type: str) -> str:
    message = Message()
    message["Content-Type"] = content_type
    parameters = message.get_params(header="Content-Type", unquote=True) or []
    canonical = content_type.split(";", 1)[0].strip().lower()
    normalized: dict[str, str] = {}
    for name, value in parameters[1:]:
        name = name.strip().lower()
        if name in normalized or not isinstance(value, str):
            raise APIError(422, "invalid_media_type", "MIME parameters must be unique strings")
        value = value.strip()
        if name == "codecs":
            value = ",".join(codec.strip().lower() for codec in value.split(","))
        normalized[name] = value
    for name, value in sorted(normalized.items()):
        canonical += f";{name}={json.dumps(value, ensure_ascii=True)}"
    if len(canonical) > 128:
        raise APIError(422, "invalid_media_type", "Normalized MIME parameters are too long")
    return canonical


async def save_chunk(
    session: AsyncSession,
    config: Settings,
    owner_id: str,
    meeting_id: UUID,
    recording_id: UUID,
    sequence: int,
    start_ms: int,
    end_ms: int,
    content_type: str,
    received: storage.ReceivedFile,
) -> Recording:
    try:
        row = await recording(session, owner_id, meeting_id, recording_id, lock=True)
        if row.source == "file":
            raise APIError(409, "source_mismatch", "This recording accepts a complete file")
        content_type = normalize_mime(content_type)
        existing = await session.get(RecordingChunk, (recording_id, sequence))
        if existing is not None:
            if (existing.sha256, existing.start_ms, existing.end_ms, existing.content_type) != (
                received.sha256,
                start_ms,
                end_ms,
                content_type,
            ):
                raise APIError(
                    409, "chunk_conflict", "A different chunk already exists at this sequence"
                )
            return row
        ensure_receiving(row)
        if sequence >= config.recording_max_chunks:
            raise APIError(422, "chunk_limit", "Recording exceeds the chunk count limit")
        if end_ms <= start_ms or end_ms > config.recording_max_duration_ms:
            raise APIError(422, "invalid_interval", "Chunk interval exceeds recording limits")
        if content_type != normalize_mime(row.content_type):
            raise APIError(409, "chunk_conflict", "Chunk MIME must match the recording MIME")
        if row.size_bytes + received.size_bytes > config.recording_max_bytes:
            raise APIError(413, "recording_too_large", "Recording exceeds the byte limit")
        chunk = RecordingChunk(
            recording_id=row.id,
            sequence=sequence,
            start_ms=start_ms,
            end_ms=end_ms,
            content_type=content_type,
            size_bytes=received.size_bytes,
            sha256=received.sha256,
        )
        destination = chunk_path(config, chunk)
        destination.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
        received.path.replace(destination)
        session.add(chunk)
        row.chunk_count += 1
        row.size_bytes += received.size_bytes
        row.status = "receiving"
        row.error_code = None
        await session.commit()
        await session.refresh(row)
        return row
    finally:
        received.path.unlink(missing_ok=True)


def check_finalize(row: Recording, body: RecordingFinalize) -> bool:
    if finalized(row):
        if (row.finalized_expected_chunks, row.finalized_is_complete) == (
            body.expected_chunks,
            body.is_complete,
        ):
            return True
        raise APIError(
            409, "recording_finalized", "Recording was finalized with different parameters"
        )
    ensure_receiving(row)
    if row.source == "file":
        raise APIError(409, "source_mismatch", "Complete files use the file endpoint")
    return False


async def finalize_recording(
    session: AsyncSession,
    config: Settings,
    owner_id: str,
    meeting_id: UUID,
    recording_id: UUID,
    body: RecordingFinalize,
) -> Recording:
    row = await recording(session, owner_id, meeting_id, recording_id, lock=True)
    if check_finalize(row, body):
        return row
    if body.expected_chunks > config.recording_max_chunks:
        raise APIError(422, "chunk_limit", "Recording exceeds the chunk count limit")
    chunks = list(
        await session.scalars(
            select(RecordingChunk)
            .where(RecordingChunk.recording_id == recording_id)
            .order_by(RecordingChunk.sequence)
        )
    )
    prefix = chunks[: body.expected_chunks]
    if [chunk.sequence for chunk in prefix] != list(range(body.expected_chunks)) or (
        body.is_complete and len(chunks) != body.expected_chunks
    ):
        raise APIError(
            409, "missing_chunks", "Finalize requires exactly the contiguous requested prefix"
        )
    if not prefix:
        if body.is_complete:
            raise APIError(409, "missing_chunks", "A complete recording requires audio chunks")
        row.status = "incomplete"
        row.finalized_expected_chunks = 0
        row.finalized_is_complete = False
        row.error_code = "recording_interrupted"
        await session.commit()
        await session.refresh(row)
        return row
    version = row.updated_at
    paths = [chunk_path(config, chunk) for chunk in prefix]
    await session.commit()
    received = None
    audio = None
    try:
        try:
            received = await asyncio.to_thread(
                storage.combine, paths, config.recording_storage_path, config.recording_max_bytes
            )
            audio = await storage.normalize(
                received.path,
                config.recording_storage_path,
                config.recording_max_duration_ms,
                config.recording_media_timeout_seconds,
            )
        except APIError as exc:
            await fail_recording(session, owner_id, meeting_id, recording_id, version, exc)
            raise
        except FileNotFoundError as exc:
            # A concurrent DELETE must not recreate the recording or publish its bytes.
            await recording(session, owner_id, meeting_id, recording_id)
            raise APIError(
                503, "recording_storage_unavailable", "Recording chunks are unavailable"
            ) from exc
        row = await recording(session, owner_id, meeting_id, recording_id, lock=True)
        if check_finalize(row, body):
            return row
        if row.updated_at != version:
            raise APIError(409, "recording_changed", "Recording changed during finalization; retry")
        publish(config, row, received, audio)
        row.status = "ready" if body.is_complete else "incomplete"
        row.error_code = None if body.is_complete else "recording_interrupted"
        row.finalized_expected_chunks = body.expected_chunks
        row.finalized_is_complete = body.is_complete
        await session.commit()
        await session.refresh(row)
        return row
    finally:
        if received is not None:
            received.path.unlink(missing_ok=True)
        if audio is not None:
            audio.path.unlink(missing_ok=True)


async def remove_files(config: Settings, recording_ids: list[UUID]) -> None:
    try:
        await asyncio.to_thread(
            storage.remove_recordings, config.recording_storage_path, recording_ids
        )
    except OSError as exc:
        raise APIError(
            503, "recording_cleanup_failed", "Recording files could not be deleted; retry"
        ) from exc


async def delete_recording(
    session: AsyncSession, config: Settings, owner_id: str, meeting_id: UUID, recording_id: UUID
) -> None:
    row = await recording(session, owner_id, meeting_id, recording_id, lock=True)
    await remove_files(config, [row.id])
    await session.delete(row)
    await session.commit()


async def media_path(
    session: AsyncSession, config: Settings, owner_id: str, meeting_id: UUID, recording_id: UUID
) -> Path:
    row = await recording(session, owner_id, meeting_id, recording_id)
    if row.media_size_bytes is None or row.status not in {"ready", "incomplete"}:
        raise APIError(409, "recording_not_playable", "Recording has no validated playback audio")
    path = storage.recording_dir(config.recording_storage_path, row.id) / "media.wav"
    if not path.is_file():
        raise APIError(503, "recording_storage_unavailable", "Recording media is unavailable")
    await session.commit()
    return path
