"""Meeting HTTP boundary. All media requests use the existing bearer identity."""

from typing import Annotated, Any, cast
from uuid import UUID

from fastapi import APIRouter, Depends, Header, Query, Request, Response
from fastapi import Path as PathParam
from fastapi.responses import FileResponse
from starlette.requests import ClientDisconnect
from starlette.types import Message, Receive, Scope, Send

from saint_tibo.auth.dependencies import require_permissions
from saint_tibo.auth.policy import Permission
from saint_tibo.auth.schemas import CurrentUser
from saint_tibo.core.config import Settings
from saint_tibo.core.errors import APIError, ErrorResponse, error_response
from saint_tibo.core.pagination import Page, Pagination
from saint_tibo.db.session import DatabaseSession
from saint_tibo.modules.meetings import service, storage
from saint_tibo.modules.meetings.schemas import (
    MediaType,
    MeetingCreate,
    MeetingRead,
    MeetingUpdate,
    ParticipantCreate,
    ParticipantRead,
    ParticipantUpdate,
    RecordingCreate,
    RecordingFinalize,
    RecordingRead,
)

ReadUser = Annotated[CurrentUser, Depends(require_permissions(Permission.MEETING_READ))]
WriteUser = Annotated[CurrentUser, Depends(require_permissions(Permission.MEETING_WRITE))]
router = APIRouter(
    prefix="/meetings",
    tags=["meetings"],
    responses={
        code: {"model": ErrorResponse} for code in (400, 401, 403, 404, 408, 409, 413, 415, 503)
    },
)
RAW_BODY = {
    "requestBody": {
        "required": True,
        "description": (
            "Raw binary stream, not multipart. Maximum 512 MiB per recording / "
            "8 MiB per chunk by default; the server may set lower limits."
        ),
        "content": {"application/octet-stream": {"schema": {"type": "string", "format": "binary"}}},
    }
}


def settings(request: Request) -> Settings:
    return cast(Settings, request.app.state.settings)


@router.get("", operation_id="listMeetings")
async def list_meetings(
    session: DatabaseSession, user: ReadUser, pagination: Pagination
) -> Page[MeetingRead]:
    rows, total = await service.list_meetings(session, user.id, pagination)
    return Page(
        items=[MeetingRead.model_validate(row) for row in rows],
        total=total,
        **pagination.model_dump(),
    )


@router.post("", status_code=201, operation_id="createMeeting")
async def create_meeting(
    body: MeetingCreate, session: DatabaseSession, user: WriteUser
) -> MeetingRead:
    return MeetingRead.model_validate(await service.create_meeting(session, user.id, body))


@router.get("/{meeting_id}", operation_id="getMeeting")
async def get_meeting(meeting_id: UUID, session: DatabaseSession, user: ReadUser) -> MeetingRead:
    return MeetingRead.model_validate(await service.meeting(session, user.id, meeting_id))


@router.patch("/{meeting_id}", operation_id="updateMeeting")
async def update_meeting(
    meeting_id: UUID, body: MeetingUpdate, session: DatabaseSession, user: WriteUser
) -> MeetingRead:
    return MeetingRead.model_validate(
        await service.update_meeting(session, user.id, meeting_id, body)
    )


@router.delete("/{meeting_id}", status_code=204, operation_id="deleteMeeting")
async def delete_meeting(
    meeting_id: UUID, request: Request, session: DatabaseSession, user: WriteUser
) -> Response:
    await service.delete_meeting(session, settings(request), user.id, meeting_id)
    return Response(status_code=204)


@router.get("/{meeting_id}/participants", operation_id="listParticipants")
async def list_participants(
    meeting_id: UUID, session: DatabaseSession, user: ReadUser, pagination: Pagination
) -> Page[ParticipantRead]:
    rows, total = await service.list_participants(session, user.id, meeting_id, pagination)
    return Page(
        items=[ParticipantRead.model_validate(row) for row in rows],
        total=total,
        **pagination.model_dump(),
    )


@router.post("/{meeting_id}/participants", status_code=201, operation_id="createParticipant")
async def create_participant(
    meeting_id: UUID, body: ParticipantCreate, session: DatabaseSession, user: WriteUser
) -> ParticipantRead:
    return ParticipantRead.model_validate(
        await service.create_participant(session, user.id, meeting_id, body)
    )


@router.patch("/{meeting_id}/participants/{participant_id}", operation_id="updateParticipant")
async def update_participant(
    meeting_id: UUID,
    participant_id: UUID,
    body: ParticipantUpdate,
    session: DatabaseSession,
    user: WriteUser,
) -> ParticipantRead:
    return ParticipantRead.model_validate(
        await service.update_participant(session, user.id, meeting_id, participant_id, body)
    )


@router.delete(
    "/{meeting_id}/participants/{participant_id}", status_code=204, operation_id="deleteParticipant"
)
async def delete_participant(
    meeting_id: UUID, participant_id: UUID, session: DatabaseSession, user: WriteUser
) -> Response:
    await service.delete_participant(session, user.id, meeting_id, participant_id)
    return Response(status_code=204)


@router.get("/{meeting_id}/recordings", operation_id="listRecordings")
async def list_recordings(
    meeting_id: UUID,
    request: Request,
    session: DatabaseSession,
    user: ReadUser,
    pagination: Pagination,
) -> Page[RecordingRead]:
    rows, total = await service.list_recordings(
        session, settings(request), user.id, meeting_id, pagination
    )
    return Page(
        items=[RecordingRead.model_validate(row) for row in rows],
        total=total,
        **pagination.model_dump(),
    )


@router.post("/{meeting_id}/recordings", status_code=201, operation_id="createRecording")
async def create_recording(
    meeting_id: UUID, body: RecordingCreate, session: DatabaseSession, user: WriteUser
) -> RecordingRead:
    return RecordingRead.model_validate(
        await service.create_recording(session, user.id, meeting_id, body)
    )


@router.get("/{meeting_id}/recordings/{recording_id}", operation_id="getRecording")
async def get_recording(
    meeting_id: UUID, recording_id: UUID, request: Request, session: DatabaseSession, user: ReadUser
) -> RecordingRead:
    await service.mark_stale(session, settings(request), user.id, meeting_id)
    return RecordingRead.model_validate(
        await service.recording(session, user.id, meeting_id, recording_id)
    )


async def receive_body(request: Request, config: Settings, limit: int) -> storage.ReceivedFile:
    length = request.headers.get("content-length")
    if length is not None:
        try:
            size = int(length)
        except ValueError as exc:
            raise APIError(
                400, "invalid_content_length", "Content-Length must be an integer"
            ) from exc
        if size < 0:
            raise APIError(400, "invalid_content_length", "Content-Length cannot be negative")
        if size > limit:
            raise APIError(413, "recording_too_large", "Request exceeds the byte limit")
    try:
        return await storage.receive(
            request.stream(),
            config.recording_storage_path,
            limit,
            config.recording_upload_timeout_seconds,
        )
    except ClientDisconnect as exc:
        raise APIError(400, "upload_interrupted", "Recording upload was interrupted") from exc


@router.put(
    "/{meeting_id}/recordings/{recording_id}/file",
    operation_id="uploadRecordingFile",
    openapi_extra=RAW_BODY,
)
async def upload_file(
    meeting_id: UUID,
    recording_id: UUID,
    request: Request,
    session: DatabaseSession,
    user: WriteUser,
) -> RecordingRead:
    row = await service.recording(session, user.id, meeting_id, recording_id)
    if row.source != "file":
        raise APIError(409, "source_mismatch", "This recording accepts live chunks")
    if not service.finalized(row):
        service.ensure_receiving(row)
    await session.commit()
    config = settings(request)
    received = await receive_body(request, config, config.recording_max_bytes)
    row = await service.publish_file(session, config, user.id, meeting_id, recording_id, received)
    return RecordingRead.model_validate(row)


@router.put(
    "/{meeting_id}/recordings/{recording_id}/chunks/{sequence}",
    operation_id="uploadRecordingChunk",
    openapi_extra=RAW_BODY,
)
async def upload_chunk(
    meeting_id: UUID,
    recording_id: UUID,
    request: Request,
    session: DatabaseSession,
    user: WriteUser,
    sequence: Annotated[int, PathParam(ge=0, le=4095)],
    start_ms: Annotated[int, Query(ge=0)],
    end_ms: Annotated[int, Query(gt=0)],
    content_type: Annotated[MediaType, Header()],
) -> RecordingRead:
    row = await service.recording(session, user.id, meeting_id, recording_id)
    if row.source == "file":
        raise APIError(409, "source_mismatch", "This recording accepts a complete file")
    await session.commit()
    config = settings(request)
    if end_ms <= start_ms or end_ms > config.recording_max_duration_ms:
        raise APIError(422, "invalid_interval", "Chunk interval exceeds recording limits")
    received = await receive_body(request, config, config.recording_chunk_max_bytes)
    row = await service.save_chunk(
        session,
        config,
        user.id,
        meeting_id,
        recording_id,
        sequence,
        start_ms,
        end_ms,
        content_type,
        received,
    )
    return RecordingRead.model_validate(row)


@router.post("/{meeting_id}/recordings/{recording_id}/finalize", operation_id="finalizeRecording")
async def finalize_recording(
    meeting_id: UUID,
    recording_id: UUID,
    body: RecordingFinalize,
    request: Request,
    session: DatabaseSession,
    user: WriteUser,
) -> RecordingRead:
    return RecordingRead.model_validate(
        await service.finalize_recording(
            session, settings(request), user.id, meeting_id, recording_id, body
        )
    )


@router.delete(
    "/{meeting_id}/recordings/{recording_id}", status_code=204, operation_id="deleteRecording"
)
async def delete_recording(
    meeting_id: UUID,
    recording_id: UUID,
    request: Request,
    session: DatabaseSession,
    user: WriteUser,
) -> Response:
    await service.delete_recording(session, settings(request), user.id, meeting_id, recording_id)
    return Response(status_code=204)


class PrivateMediaResponse(FileResponse):
    """Keep Starlette's range streaming, with our private error envelope on bad ranges."""

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        replacement: Response | None = None

        async def checked_send(message: Message) -> None:
            nonlocal replacement
            if message["type"] == "http.response.start" and message["status"] in {400, 416}:
                status = message["status"]
                replacement = error_response(
                    status, "invalid_range", "Requested byte range is invalid"
                )
                replacement.headers["Cache-Control"] = "private, no-store"
                replacement.headers["X-Content-Type-Options"] = "nosniff"
                for key, value in message["headers"]:
                    if key.lower() == b"content-range":
                        replacement.headers["Content-Range"] = value.decode("latin-1")
                message = {**message, "headers": replacement.raw_headers}
            elif message["type"] == "http.response.body" and replacement is not None:
                message = {
                    **message,
                    "body": b"" if scope["method"] == "HEAD" else replacement.body,
                }
            await send(message)

        await super().__call__(scope, receive, checked_send)


MEDIA_RESPONSES: dict[int | str, dict[str, Any]] = {
    200: {"content": {"audio/wav": {"schema": {"type": "string", "format": "binary"}}}},
    206: {
        "description": "A byte range of the playback WAV",
        "content": {"audio/wav": {"schema": {"type": "string", "format": "binary"}}},
    },
    416: {"model": ErrorResponse, "headers": {"Content-Range": {"schema": {"type": "string"}}}},
}


@router.get(
    "/{meeting_id}/recordings/{recording_id}/media",
    operation_id="getRecordingMedia",
    response_class=FileResponse,
    responses=MEDIA_RESPONSES,
)
async def get_media(
    meeting_id: UUID,
    recording_id: UUID,
    request: Request,
    session: DatabaseSession,
    user: ReadUser,
    range_header: Annotated[str | None, Header(alias="Range", max_length=8192)] = None,
    if_range: Annotated[str | None, Header(alias="If-Range", max_length=512)] = None,
) -> FileResponse:
    path = await service.media_path(session, settings(request), user.id, meeting_id, recording_id)
    return PrivateMediaResponse(
        path,
        media_type="audio/wav",
        filename="recording.wav",
        content_disposition_type="inline",
        headers={"Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff"},
    )


@router.head(
    "/{meeting_id}/recordings/{recording_id}/media",
    operation_id="headRecordingMedia",
    response_class=FileResponse,
    responses=MEDIA_RESPONSES,
)
async def head_media(
    meeting_id: UUID,
    recording_id: UUID,
    request: Request,
    session: DatabaseSession,
    user: ReadUser,
    range_header: Annotated[str | None, Header(alias="Range", max_length=8192)] = None,
    if_range: Annotated[str | None, Header(alias="If-Range", max_length=512)] = None,
) -> FileResponse:
    return await get_media(meeting_id, recording_id, request, session, user)
