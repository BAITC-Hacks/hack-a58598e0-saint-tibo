from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator

from saint_tibo.core.schemas import ReadModel


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
    completed_stage: Literal["transcribe"]
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
