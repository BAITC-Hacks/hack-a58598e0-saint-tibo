from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from saint_tibo.core.schemas import ReadModel


class ProcessingJobCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    request_key: UUID = Field(description="Generate once per user action; reuse on HTTP retries.")
    retry_of_job_id: UUID | None = Field(
        default=None, description="Retry a failed/interrupted job of this recording as a new job."
    )
    allow_incomplete: bool = False
    language: Literal["auto", "ru", "kk", "mixed"] = "auto"
    target_stage: Literal["transcribe", "extract"] = Field(
        default="transcribe", description="transcribe produces a transcript; extract also produces an unreviewed local-model draft."
    )


class ProcessingJobRead(ReadModel):
    id: UUID
    recording_id: UUID
    request_key: UUID
    retry_of_job_id: UUID | None
    allow_incomplete: bool
    language: Literal["auto", "ru", "kk", "mixed"]
    target_stage: Literal["transcribe", "extract"]
    attempt: int
    status: Literal["queued", "running", "succeeded", "failed", "interrupted"]
    stage: Literal["decode", "transcribe", "diarize", "extract", "complete"]
    progress: float | None = Field(ge=0, le=1, description="Measured progress within this stage.")
    error_code: str | None
    result_version_id: UUID | None
    created_at: datetime
    updated_at: datetime
    started_at: datetime | None
    finished_at: datetime | None
