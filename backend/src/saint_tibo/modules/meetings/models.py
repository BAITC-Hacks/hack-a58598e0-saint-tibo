"""Application-owned metadata; audio bytes live on the private recording volume."""

from datetime import datetime
from uuid import UUID

from sqlalchemy import BigInteger, CheckConstraint, DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from saint_tibo.db.base import Base
from saint_tibo.db.mixins import OwnedByUser, Timestamps, UUIDPrimaryKey


class Meeting(UUIDPrimaryKey, OwnedByUser, Timestamps, Base):
    __tablename__ = "meetings"

    title: Mapped[str] = mapped_column(String(200))
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    timezone: Mapped[str] = mapped_column(String(64))


class Participant(UUIDPrimaryKey, Timestamps, Base):
    __tablename__ = "participants"

    meeting_id: Mapped[UUID] = mapped_column(
        ForeignKey("app.meetings.id", ondelete="CASCADE"), index=True
    )
    display_name: Mapped[str] = mapped_column(String(200))
    role: Mapped[str | None] = mapped_column(String(200))


class Recording(UUIDPrimaryKey, Timestamps, Base):
    __tablename__ = "recordings"
    __table_args__ = (
        CheckConstraint("size_bytes >= 0", name="size_nonnegative"),
        CheckConstraint("chunk_count >= 0", name="chunks_nonnegative"),
    )

    meeting_id: Mapped[UUID] = mapped_column(
        ForeignKey("app.meetings.id", ondelete="CASCADE"), index=True
    )
    source: Mapped[str] = mapped_column(String(20))
    original_filename: Mapped[str] = mapped_column(String(255))
    content_type: Mapped[str] = mapped_column(String(128))
    status: Mapped[str] = mapped_column(String(20), default="receiving")
    size_bytes: Mapped[int] = mapped_column(BigInteger, default=0)
    chunk_count: Mapped[int] = mapped_column(default=0)
    duration_ms: Mapped[int | None]
    media_size_bytes: Mapped[int | None] = mapped_column(BigInteger)
    sha256: Mapped[str | None] = mapped_column(String(64))
    error_code: Mapped[str | None] = mapped_column(String(80))
    finalized_expected_chunks: Mapped[int | None]
    finalized_is_complete: Mapped[bool | None]

    @property
    def media_content_type(self) -> str | None:
        return "audio/wav" if self.media_size_bytes is not None else None

    @property
    def media_url(self) -> str | None:
        if self.media_size_bytes is None:
            return None
        return f"/api/media/meetings/{self.meeting_id}/recordings/{self.id}"


class RecordingChunk(Base):
    __tablename__ = "recording_chunks"
    __table_args__ = (
        CheckConstraint("sequence >= 0", name="sequence_nonnegative"),
        CheckConstraint("start_ms >= 0 AND end_ms > start_ms", name="valid_interval"),
        CheckConstraint("size_bytes > 0", name="size_positive"),
    )

    recording_id: Mapped[UUID] = mapped_column(
        ForeignKey("app.recordings.id", ondelete="CASCADE"), primary_key=True
    )
    sequence: Mapped[int] = mapped_column(primary_key=True)
    start_ms: Mapped[int]
    end_ms: Mapped[int]
    size_bytes: Mapped[int] = mapped_column(BigInteger)
    sha256: Mapped[str] = mapped_column(String(64))
    content_type: Mapped[str] = mapped_column(String(128))
