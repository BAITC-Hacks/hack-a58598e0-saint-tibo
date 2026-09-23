from datetime import date, datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel

from saint_tibo.core.pagination import Page


class ReminderRead(BaseModel):
    id: UUID
    meeting_id: UUID
    meeting_title: str
    recording_id: UUID
    result_version_id: UUID
    revision: int
    action_item_id: UUID
    text: str
    assignee_participant_id: UUID | None
    assignee_text: str | None
    due_text: str | None
    due_date: date
    kind: Literal["upcoming", "overdue"]
    timezone: str
    days_until_due: int


class ReminderPage(Page[ReminderRead]):
    evaluated_at: datetime
    channel: Literal["in_app"] = "in_app"
    curator_policy: Literal["meeting_owner"] = "meeting_owner"
