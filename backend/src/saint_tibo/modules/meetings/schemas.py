from datetime import UTC, datetime
from enum import StrEnum
from typing import Annotated, ClassVar
from uuid import UUID
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from pydantic import AfterValidator, AwareDatetime, BaseModel, ConfigDict, Field, StringConstraints

from saint_tibo.core.schemas import PartialUpdate, ReadModel


def valid_timezone(value: str) -> str:
    try:
        ZoneInfo(value)
    except (ZoneInfoNotFoundError, ValueError) as exc:
        raise ValueError("Expected an IANA timezone") from exc
    return value


def valid_text(value: str) -> str:
    if any(ord(char) < 32 or ord(char) == 127 for char in value):
        raise ValueError("Control characters are not allowed")
    return value


Title = Annotated[
    str,
    StringConstraints(strip_whitespace=True, min_length=1, max_length=200),
    AfterValidator(valid_text),
]
Timezone = Annotated[str, Field(min_length=1, max_length=64), AfterValidator(valid_timezone)]
EventTime = Annotated[AwareDatetime, AfterValidator(lambda value: value.astimezone(UTC))]
Filename = Annotated[
    str,
    StringConstraints(strip_whitespace=True, min_length=1, max_length=255),
    AfterValidator(valid_text),
]
MediaType = Annotated[
    str,
    StringConstraints(
        strip_whitespace=True,
        min_length=3,
        max_length=128,
        pattern=r"^[A-Za-z0-9!#$&^_.+-]+/[A-Za-z0-9!#$&^_.+-]+(?:;[^\r\n]+)?$",
    ),
    AfterValidator(valid_text),
]


class MeetingCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    title: Title
    started_at: EventTime
    timezone: Timezone


class MeetingUpdate(PartialUpdate):
    model_config = ConfigDict(extra="forbid")
    NON_NULLABLE: ClassVar[tuple[str, ...]] = ("title", "started_at", "timezone")
    title: Title | None = None
    started_at: EventTime | None = None
    timezone: Timezone | None = None


class MeetingRead(ReadModel):
    id: UUID
    owner_id: str
    title: str
    started_at: datetime
    timezone: str
    created_at: datetime
    updated_at: datetime


class ParticipantCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    display_name: Title
    role: Title | None = None


class ParticipantUpdate(PartialUpdate):
    model_config = ConfigDict(extra="forbid")
    NON_NULLABLE: ClassVar[tuple[str, ...]] = ("display_name",)
    display_name: Title | None = None
    role: Title | None = None


class ParticipantRead(ReadModel):
    id: UUID
    meeting_id: UUID
    display_name: str
    role: str | None
    created_at: datetime
    updated_at: datetime


class RecordingSource(StrEnum):
    FILE = "file"
    LIVE = "live"
    TEAMS = "teams"
    GOOGLE_MEET = "google_meet"
    ZOOM = "zoom"


class RecordingStatus(StrEnum):
    RECEIVING = "receiving"
    READY = "ready"
    INCOMPLETE = "incomplete"
    FAILED = "failed"


class RecordingCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    source: RecordingSource
    original_filename: Filename
    content_type: MediaType


class RecordingFinalize(BaseModel):
    model_config = ConfigDict(extra="forbid")
    expected_chunks: int = Field(ge=0, le=4096)
    is_complete: bool


class RecordingRead(ReadModel):
    id: UUID
    meeting_id: UUID
    source: RecordingSource
    original_filename: str
    content_type: str
    status: RecordingStatus
    size_bytes: int
    duration_ms: int | None
    media_content_type: str | None
    media_size_bytes: int | None
    media_url: str | None
    error_code: str | None
    created_at: datetime
    updated_at: datetime
