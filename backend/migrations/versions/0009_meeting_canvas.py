"""Immutable meeting canvas versions and recording/result provenance.

Revision ID: 0009
Revises: 0008
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0009"
down_revision: str | Sequence[str] | None = "0008"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "meeting_canvases",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            primary_key=True,
        ),
        sa.Column(
            "meeting_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("app.meetings.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("revision", sa.Integer(), nullable=False),
        *[
            sa.Column(name, sa.Text(), nullable=True)
            for name in (
                "purpose",
                "inputs",
                "expected_outputs",
                "facilitation_flow",
                "agenda_structure",
                "participants",
                "expected_artifacts",
            )
        ],
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.CheckConstraint("revision > 0", name="valid_revision"),
        sa.UniqueConstraint("meeting_id", "revision"),
        schema="app",
    )
    op.create_index(
        "ix_app_meeting_canvases_meeting_id", "meeting_canvases", ["meeting_id"], schema="app"
    )
    op.execute("""
        CREATE FUNCTION app.reject_canvas_change() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN RAISE EXCEPTION 'Meeting canvas versions are immutable'; END;
        $$
    """)
    op.execute("""
        CREATE TRIGGER meeting_canvas_immutable BEFORE UPDATE ON app.meeting_canvases
        FOR EACH ROW EXECUTE FUNCTION app.reject_canvas_change()
    """)
    for table in ("recordings", "result_versions"):
        op.add_column(
            table,
            sa.Column("canvas_version_id", postgresql.UUID(as_uuid=True), nullable=True),
            schema="app",
        )
        op.create_foreign_key(
            f"fk_{table}_canvas_version_id_meeting_canvases",
            table,
            "meeting_canvases",
            ["canvas_version_id"],
            ["id"],
            source_schema="app",
            referent_schema="app",
            ondelete="SET NULL",
        )


def downgrade() -> None:
    for table in ("result_versions", "recordings"):
        op.drop_constraint(
            f"fk_{table}_canvas_version_id_meeting_canvases",
            table,
            schema="app",
            type_="foreignkey",
        )
        op.drop_column(table, "canvas_version_id", schema="app")
    op.execute("DROP TRIGGER meeting_canvas_immutable ON app.meeting_canvases")
    op.execute("DROP FUNCTION app.reject_canvas_change()")
    op.drop_index("ix_app_meeting_canvases_meeting_id", table_name="meeting_canvases", schema="app")
    op.drop_table("meeting_canvases", schema="app")
