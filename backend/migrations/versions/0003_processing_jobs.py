"""Persist recording processing jobs and leases.

Revision ID: 0003
Revises: 0002
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0003"
down_revision: str | Sequence[str] | None = "0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "processing_jobs",
        sa.Column("id", sa.Uuid(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("recording_id", sa.Uuid(), nullable=False),
        sa.Column("request_key", sa.Uuid(), nullable=False),
        sa.Column("retry_of_job_id", sa.Uuid(), nullable=True),
        sa.Column("allow_incomplete", sa.Boolean(), nullable=False),
        sa.Column("language", sa.String(10), nullable=False),
        sa.Column("attempt", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("stage", sa.String(20), nullable=False),
        sa.Column("progress", sa.Float(), nullable=True),
        sa.Column("error_code", sa.String(80), nullable=True),
        sa.Column("result_version_id", sa.Uuid(), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("lease_expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("claim_token", sa.Uuid(), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.PrimaryKeyConstraint("id", name="pk_processing_jobs"),
        sa.ForeignKeyConstraint(
            ["recording_id"],
            ["app.recordings.id"],
            name="fk_processing_jobs_recording_id_recordings",
            ondelete="CASCADE",
        ),
        sa.UniqueConstraint("recording_id", "request_key", name="uq_processing_jobs_recording_id"),
        sa.CheckConstraint("attempt > 0", name=op.f("ck_processing_jobs_attempt_positive")),
        sa.CheckConstraint(
            "progress >= 0 AND progress <= 1", name=op.f("ck_processing_jobs_progress_range")
        ),
        sa.CheckConstraint(
            "status IN ('queued', 'running', 'succeeded', 'failed', 'interrupted')",
            name=op.f("ck_processing_jobs_valid_status"),
        ),
        schema="app",
    )
    op.create_index(
        "ix_app_processing_jobs_recording_id", "processing_jobs", ["recording_id"], schema="app"
    )
    op.create_index(
        "ix_processing_jobs_queue", "processing_jobs", ["status", "created_at"], schema="app"
    )
    op.create_index(
        "uq_processing_jobs_active_recording",
        "processing_jobs",
        ["recording_id"],
        unique=True,
        postgresql_where=sa.text("status IN ('queued', 'running')"),
        schema="app",
    )


def downgrade() -> None:
    op.drop_table("processing_jobs", schema="app")
