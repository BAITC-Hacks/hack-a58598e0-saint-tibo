from datetime import date, datetime
from enum import StrEnum
from typing import Annotated, Literal
from uuid import UUID, uuid4

from pydantic import AfterValidator, BaseModel, ConfigDict, Field, model_validator

from saint_tibo.core.schemas import PartialUpdate, ReadModel


class TranscriptSegment(BaseModel):
    model_config = ConfigDict(extra="forbid")
    start_ms: int = Field(ge=0)
    end_ms: int = Field(gt=0)
    text: str = Field(min_length=1, max_length=10000)

    @model_validator(mode="after")
    def valid_interval(self) -> "TranscriptSegment":
        if self.end_ms <= self.start_ms:
            raise ValueError("Segment must have a positive duration")
        return self


class ResultVersionRead(ReadModel):
    id: UUID
    recording_id: UUID
    job_id: UUID
    revision: int
    status: Literal["draft", "reviewed"]
    completed_stage: Literal["transcribe", "diarize"]
    is_incomplete: bool
    language: str
    duration_ms: int
    model_id: str
    model_revision: str
    segment_count: int
    created_at: datetime
    updated_at: datetime


class SegmentRead(ReadModel):
    id: UUID
    recording_id: UUID
    result_version_id: UUID
    speaker_id: UUID | None
    start_ms: int
    end_ms: int
    text: str


class DiarizationSpeaker(BaseModel):
    model_config = ConfigDict(extra="forbid")

    speaker_id: UUID
    label: str = Field(pattern=r"^speaker_[0-9]{2}$")


class DiarizationTurn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    speaker_id: UUID
    start_ms: int = Field(ge=0)
    end_ms: int = Field(gt=0)


class DiarizationProvenance(BaseModel):
    model_config = ConfigDict(extra="forbid")

    bundle_id: str
    sherpa_onnx_version: str
    model_sha256: dict[str, str]
    requested_num_speakers: int
    cluster_threshold: float


class DiarizationData(BaseModel):
    model_config = ConfigDict(extra="forbid")

    duration_ms: int = Field(gt=0)
    speakers: list[DiarizationSpeaker] = Field(min_length=1, max_length=32)
    turns: list[DiarizationTurn] = Field(min_length=1, max_length=20000)
    provenance: DiarizationProvenance

    @model_validator(mode="after")
    def valid_timeline(self) -> "DiarizationData":
        ids = {speaker.speaker_id for speaker in self.speakers}
        if len(ids) != len(self.speakers):
            raise ValueError("Duplicate speaker identifiers")
        previous_start = -1
        for turn in self.turns:
            if (turn.speaker_id not in ids or turn.start_ms < previous_start
                    or not turn.start_ms < turn.end_ms <= self.duration_ms):
                raise ValueError("Invalid speaker timeline")
            previous_start = turn.start_ms
        return self


class DiarizationRead(DiarizationData):
    result_version_id: UUID
    recording_id: UUID


class ReviewSpeakerAssignment(BaseModel):
    model_config = ConfigDict(extra="forbid")

    speaker_id: UUID
    participant_id: UUID | None = None
    merged_into_speaker_id: UUID | None = None


class ReviewSpeakerRead(ReviewSpeakerAssignment):
    label: str


def document_text(value: str) -> str:
    if not value.strip() or any(
        ord(char) < 32
        and char not in "\t\n\r"
        or 0xD800 <= ord(char) <= 0xDFFF
        or ord(char) in (0xFFFE, 0xFFFF)
        for char in value
    ):
        raise ValueError("Text must be nonblank and contain valid document characters")
    return value


ReviewText = Annotated[str, Field(min_length=1, max_length=2000), AfterValidator(document_text)]
ReviewLabel = Annotated[str, Field(min_length=1, max_length=500), AfterValidator(document_text)]


class ActionItemStatus(StrEnum):
    OPEN = "open"
    IN_PROGRESS = "in_progress"
    DONE = "done"
    CANCELLED = "cancelled"


class ReviewActionItem(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: UUID = Field(default_factory=uuid4)
    text: ReviewText
    assignee_participant_id: UUID | None = None
    assignee_text: ReviewLabel | None = None
    due_text: ReviewLabel | None = None
    due_date: date | None = None
    status: ActionItemStatus = ActionItemStatus.OPEN
    source_segment_ids: list[UUID] = Field(default_factory=list, max_length=100)


class ReviewActionItemRead(ReviewActionItem):
    result_version_id: UUID


class ReviewSummary(BaseModel):
    model_config = ConfigDict(extra="forbid")

    topics: list[ReviewText] = Field(default_factory=list, max_length=100)
    decisions: list[ReviewText] = Field(default_factory=list, max_length=100)
    open_questions: list[ReviewText] = Field(default_factory=list, max_length=100)
    source_segment_ids: list[UUID] = Field(default_factory=list, max_length=100)


class ReviewUpdate(PartialUpdate):
    model_config = ConfigDict(extra="forbid")
    NON_NULLABLE = ("reviewed", "action_items", "summary", "speakers")

    revision: int = Field(ge=1)
    reviewed: bool | None = None
    action_items: list[ReviewActionItem] | None = Field(default=None, max_length=200)
    summary: ReviewSummary | None = None
    speakers: list[ReviewSpeakerAssignment] | None = Field(default=None, max_length=32)

    @model_validator(mode="after")
    def distinct_items(self) -> "ReviewUpdate":
        if self.model_fields_set == {"revision"}:
            raise ValueError("Supply at least one review field")
        if self.action_items is not None:
            ids = [item.id for item in self.action_items]
            if len(ids) != len(set(ids)):
                raise ValueError("Action item IDs must be unique within the revision")
        if self.speakers is not None:
            ids = [speaker.speaker_id for speaker in self.speakers]
            if len(ids) != len(set(ids)):
                raise ValueError("Speaker IDs must be unique within the revision")
        return self


class ReviewMeeting(ReadModel):
    title: str
    started_at: datetime
    timezone: str


class ReviewParticipant(ReadModel):
    id: UUID
    display_name: str
    role: str | None


class ReviewRead(BaseModel):
    source: Literal["persisted"] = "persisted"
    result_version_id: UUID
    recording_id: UUID
    revision: int
    reviewed: bool
    is_incomplete: bool
    saved_at: datetime | None
    meeting: ReviewMeeting
    participants: list[ReviewParticipant]
    action_items: list[ReviewActionItemRead]
    summary: ReviewSummary
    speakers: list[ReviewSpeakerRead] = Field(default_factory=list)
