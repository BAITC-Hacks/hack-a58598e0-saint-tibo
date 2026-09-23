"""add meetings and private recordings

Revision ID: 0002
Revises: 0001
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0002"
down_revision: str | Sequence[str] | None = "0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "meetings",
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("timezone", sa.String(length=64), nullable=False),
        sa.Column("id", sa.Uuid(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("owner_id", sa.String(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_meetings")),
        schema="app",
    )
    op.create_index(
        op.f("ix_app_meetings_owner_id"), "meetings", ["owner_id"], unique=False, schema="app"
    )
    op.create_table(
        "participants",
        sa.Column("meeting_id", sa.Uuid(), nullable=False),
        sa.Column("display_name", sa.String(length=200), nullable=False),
        sa.Column("role", sa.String(length=200), nullable=True),
        sa.Column("id", sa.Uuid(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["meeting_id"],
            ["app.meetings.id"],
            name=op.f("fk_participants_meeting_id_meetings"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_participants")),
        schema="app",
    )
    op.create_index(
        op.f("ix_app_participants_meeting_id"),
        "participants",
        ["meeting_id"],
        unique=False,
        schema="app",
    )
    op.create_table(
        "recordings",
        sa.Column("meeting_id", sa.Uuid(), nullable=False),
        sa.Column("source", sa.String(length=20), nullable=False),
        sa.Column("original_filename", sa.String(length=255), nullable=False),
        sa.Column("content_type", sa.String(length=128), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("size_bytes", sa.BigInteger(), nullable=False),
        sa.Column("chunk_count", sa.Integer(), nullable=False),
        sa.Column("duration_ms", sa.Integer(), nullable=True),
        sa.Column("media_size_bytes", sa.BigInteger(), nullable=True),
        sa.Column("sha256", sa.String(length=64), nullable=True),
        sa.Column("error_code", sa.String(length=80), nullable=True),
        sa.Column("finalized_expected_chunks", sa.Integer(), nullable=True),
        sa.Column("finalized_is_complete", sa.Boolean(), nullable=True),
        sa.Column("id", sa.Uuid(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint("chunk_count >= 0", name=op.f("ck_recordings_chunks_nonnegative")),
        sa.CheckConstraint("size_bytes >= 0", name=op.f("ck_recordings_size_nonnegative")),
        sa.ForeignKeyConstraint(
            ["meeting_id"],
            ["app.meetings.id"],
            name=op.f("fk_recordings_meeting_id_meetings"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_recordings")),
        schema="app",
    )
    op.create_index(
        op.f("ix_app_recordings_meeting_id"),
        "recordings",
        ["meeting_id"],
        unique=False,
        schema="app",
    )
    op.create_table(
        "recording_chunks",
        sa.Column("recording_id", sa.Uuid(), nullable=False),
        sa.Column("sequence", sa.Integer(), nullable=False),
        sa.Column("start_ms", sa.Integer(), nullable=False),
        sa.Column("end_ms", sa.Integer(), nullable=False),
        sa.Column("size_bytes", sa.BigInteger(), nullable=False),
        sa.Column("sha256", sa.String(length=64), nullable=False),
        sa.Column("content_type", sa.String(length=128), nullable=False),
        sa.CheckConstraint("sequence >= 0", name=op.f("ck_recording_chunks_sequence_nonnegative")),
        sa.CheckConstraint("size_bytes > 0", name=op.f("ck_recording_chunks_size_positive")),
        sa.CheckConstraint(
            "start_ms >= 0 AND end_ms > start_ms", name=op.f("ck_recording_chunks_valid_interval")
        ),
        sa.ForeignKeyConstraint(
            ["recording_id"],
            ["app.recordings.id"],
            name=op.f("fk_recording_chunks_recording_id_recordings"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("recording_id", "sequence", name=op.f("pk_recording_chunks")),
        schema="app",
    )


def downgrade() -> None:
    op.drop_table("recording_chunks", schema="app")
    op.drop_index(op.f("ix_app_recordings_meeting_id"), table_name="recordings", schema="app")
    op.drop_table("recordings", schema="app")
    op.drop_index(op.f("ix_app_participants_meeting_id"), table_name="participants", schema="app")
    op.drop_table("participants", schema="app")
    op.drop_index(op.f("ix_app_meetings_owner_id"), table_name="meetings", schema="app")
    op.drop_table("meetings", schema="app")
