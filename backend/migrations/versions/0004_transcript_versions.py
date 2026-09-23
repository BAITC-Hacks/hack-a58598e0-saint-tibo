"""Add immutable transcript versions and timecoded segments.

Revision ID: 0004
Revises: 0003
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0004"
down_revision: str | Sequence[str] | None = "0003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "processing_jobs",
        sa.Column("target_stage", sa.String(20), server_default="transcribe", nullable=False),
        schema="app",
    )
    op.create_table(
        "result_versions",
        sa.Column("id", sa.Uuid(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("recording_id", sa.Uuid(), nullable=False),
        sa.Column("job_id", sa.Uuid(), nullable=False),
        sa.Column("revision", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("completed_stage", sa.String(20), nullable=False),
        sa.Column("is_incomplete", sa.Boolean(), nullable=False),
        sa.Column("language", sa.String(16), nullable=False),
        sa.Column("duration_ms", sa.Integer(), nullable=False),
        sa.Column("model_id", sa.String(120), nullable=False),
        sa.Column("model_revision", sa.String(40), nullable=False),
        sa.Column("segment_count", sa.Integer(), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.PrimaryKeyConstraint("id", name="pk_result_versions"),
        sa.ForeignKeyConstraint(
            ["recording_id"],
            ["app.recordings.id"],
            name="fk_result_versions_recording_id_recordings",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["job_id"],
            ["app.processing_jobs.id"],
            name="fk_result_versions_job_id_processing_jobs",
            ondelete="CASCADE",
        ),
        sa.UniqueConstraint("job_id", name="uq_result_versions_job_id"),
        schema="app",
    )
    op.create_index(
        "ix_app_result_versions_recording_id", "result_versions", ["recording_id"], schema="app"
    )
    op.create_table(
        "segments",
        sa.Column("id", sa.Uuid(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("recording_id", sa.Uuid(), nullable=False),
        sa.Column("result_version_id", sa.Uuid(), nullable=False),
        sa.Column("speaker_id", sa.Uuid(), nullable=True),
        sa.Column("start_ms", sa.Integer(), nullable=False),
        sa.Column("end_ms", sa.Integer(), nullable=False),
        sa.Column("text", sa.Text(), nullable=False),
        sa.PrimaryKeyConstraint("id", name="pk_segments"),
        sa.ForeignKeyConstraint(
            ["recording_id"],
            ["app.recordings.id"],
            name="fk_segments_recording_id_recordings",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["result_version_id"],
            ["app.result_versions.id"],
            name="fk_segments_result_version_id_result_versions",
            ondelete="CASCADE",
        ),
        sa.CheckConstraint(
            "start_ms >= 0 AND end_ms > start_ms", name=op.f("ck_segments_valid_interval")
        ),
        schema="app",
    )
    op.create_index(
        "ix_segments_result_timeline",
        "segments",
        ["result_version_id", "start_ms", "id"],
        schema="app",
    )


def downgrade() -> None:
    op.drop_table("segments", schema="app")
    op.drop_table("result_versions", schema="app")
    op.drop_column("processing_jobs", "target_stage", schema="app")
