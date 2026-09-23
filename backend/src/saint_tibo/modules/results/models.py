from typing import Any
from uuid import UUID

from sqlalchemy import CheckConstraint, ForeignKey, Index, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from saint_tibo.db.base import Base
from saint_tibo.db.mixins import Timestamps, UUIDPrimaryKey


class ResultVersion(UUIDPrimaryKey, Timestamps, Base):
    __tablename__ = "result_versions"

    recording_id: Mapped[UUID] = mapped_column(
        ForeignKey("app.recordings.id", ondelete="CASCADE"), index=True
    )
    canvas_version_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("app.meeting_canvases.id", ondelete="SET NULL")
    )
    job_id: Mapped[UUID] = mapped_column(
        ForeignKey("app.processing_jobs.id", ondelete="CASCADE"), unique=True
    )
    revision: Mapped[int] = mapped_column(default=1)
    status: Mapped[str] = mapped_column(String(20), default="draft")
    completed_stage: Mapped[str] = mapped_column(String(20), default="transcribe")
    is_incomplete: Mapped[bool]
    language: Mapped[str] = mapped_column(String(16))
    duration_ms: Mapped[int]
    model_id: Mapped[str] = mapped_column(String(120))
    model_revision: Mapped[str] = mapped_column(String(40))
    segment_count: Mapped[int]
    extraction_draft: Mapped[dict[str, Any] | None] = mapped_column(JSONB)
    diarization: Mapped[dict[str, Any] | None] = mapped_column(JSONB)


class Segment(UUIDPrimaryKey, Base):
    __tablename__ = "segments"
    __table_args__ = (
        CheckConstraint("start_ms >= 0 AND end_ms > start_ms", name="valid_interval"),
        Index("ix_segments_result_timeline", "result_version_id", "start_ms", "id"),
    )

    result_version_id: Mapped[UUID] = mapped_column(
        ForeignKey("app.result_versions.id", ondelete="CASCADE")
    )
    recording_id: Mapped[UUID] = mapped_column(ForeignKey("app.recordings.id", ondelete="CASCADE"))
    speaker_id: Mapped[UUID | None]
    start_ms: Mapped[int]
    end_ms: Mapped[int]
    text: Mapped[str] = mapped_column(Text)


class ResultReview(Base):
    """Append-only human revisions, including the metadata used by exports."""

    __tablename__ = "result_reviews"
    __table_args__ = (CheckConstraint("revision >= 2", name="valid_revision"),)

    result_version_id: Mapped[UUID] = mapped_column(
        ForeignKey("app.result_versions.id", ondelete="CASCADE"), primary_key=True
    )
    revision: Mapped[int] = mapped_column(primary_key=True)
    # hack: bounded action items live in the revision snapshot; normalize when
    # reminders (#15) need cross-meeting queries, retaining these export snapshots.
    payload: Mapped[dict[str, Any]] = mapped_column(JSONB)
