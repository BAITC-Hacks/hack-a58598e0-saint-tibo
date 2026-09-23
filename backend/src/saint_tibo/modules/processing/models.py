from datetime import datetime
from uuid import UUID

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, String, UniqueConstraint, text
from sqlalchemy.orm import Mapped, mapped_column

from saint_tibo.db.base import Base
from saint_tibo.db.mixins import Timestamps, UUIDPrimaryKey


class ProcessingJob(UUIDPrimaryKey, Timestamps, Base):
    __tablename__ = "processing_jobs"
    __table_args__ = (
        UniqueConstraint("recording_id", "request_key"),
        CheckConstraint("attempt > 0", name="attempt_positive"),
        CheckConstraint("progress >= 0 AND progress <= 1", name="progress_range"),
        CheckConstraint(
            "status IN ('queued', 'running', 'succeeded', 'failed', 'interrupted')",
            name="valid_status",
        ),
        Index(
            "uq_processing_jobs_active_recording",
            "recording_id",
            unique=True,
            postgresql_where=text("status IN ('queued', 'running')"),
        ),
        Index("ix_processing_jobs_queue", "status", "created_at"),
    )

    recording_id: Mapped[UUID] = mapped_column(
        ForeignKey("app.recordings.id", ondelete="CASCADE"), index=True
    )
    request_key: Mapped[UUID]
    retry_of_job_id: Mapped[UUID | None]
    allow_incomplete: Mapped[bool]
    language: Mapped[str] = mapped_column(String(10))
    attempt: Mapped[int]
    status: Mapped[str] = mapped_column(String(20), default="queued")
    stage: Mapped[str] = mapped_column(String(20), default="decode")
    progress: Mapped[float | None]
    error_code: Mapped[str | None] = mapped_column(String(80))
    result_version_id: Mapped[UUID | None]
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    lease_expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    claim_token: Mapped[UUID | None]
