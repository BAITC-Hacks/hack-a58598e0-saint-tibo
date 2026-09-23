"""Export payload shaped after the reviewed ResultVersion contract.

Mirrors docs/meeting-contract.md: Meeting, Participant, Speaker, Segment,
ActionItem and the reviewed version envelope. These are render inputs —
persistence arrives with #13, until then callers assemble the payload
from stored entities or fixtures.
"""

from datetime import date, datetime
from enum import StrEnum
from uuid import UUID

from pydantic import BaseModel, Field


class ActionItemStatus(StrEnum):
    OPEN = "open"
    IN_PROGRESS = "in_progress"
    DONE = "done"
    CANCELLED = "cancelled"


class ExportMeeting(BaseModel):
    title: str
    started_at: datetime
    timezone: str


class ExportParticipant(BaseModel):
    id: UUID
    display_name: str
    role: str | None = None


class ExportSpeaker(BaseModel):
    id: UUID
    label: str
    participant_id: UUID | None = None


class ExportSegment(BaseModel):
    id: UUID
    speaker_id: UUID | None = None
    start_ms: int = Field(ge=0)
    end_ms: int = Field(ge=0)
    text: str


class ExportActionItem(BaseModel):
    id: UUID
    text: str
    assignee_participant_id: UUID | None = None
    assignee_text: str | None = None
    due_text: str | None = None
    due_date: date | None = None
    status: ActionItemStatus = ActionItemStatus.OPEN
    source_segment_ids: list[UUID] = Field(default_factory=list)


class ExportSummary(BaseModel):
    topics: list[str] = Field(default_factory=list)
    decisions: list[str] = Field(default_factory=list)
    open_questions: list[str] = Field(default_factory=list)


class ProtocolExport(BaseModel):
    """One reviewed result version rendered as the meeting protocol."""

    result_version_id: UUID
    revision: int = Field(ge=1)
    meeting: ExportMeeting
    participants: list[ExportParticipant] = Field(default_factory=list)
    speakers: list[ExportSpeaker] = Field(default_factory=list)
    segments: list[ExportSegment] = Field(default_factory=list)
    action_items: list[ExportActionItem] = Field(default_factory=list)
    summary: ExportSummary | None = None
