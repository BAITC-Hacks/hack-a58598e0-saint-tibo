"""Persist immutable human review revisions and export metadata.

Revision ID: 0005
Revises: 0004
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0005"
down_revision: str | Sequence[str] | None = "0004"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "result_reviews",
        sa.Column("result_version_id", sa.Uuid(), nullable=False),
        sa.Column("revision", sa.Integer(), nullable=False),
        sa.Column("payload", postgresql.JSONB(), nullable=False),
        sa.PrimaryKeyConstraint("result_version_id", "revision", name="pk_result_reviews"),
        sa.ForeignKeyConstraint(
            ["result_version_id"],
            ["app.result_versions.id"],
            name="fk_result_reviews_result_version_id_result_versions",
            ondelete="CASCADE",
        ),
        sa.CheckConstraint("revision >= 2", name=op.f("ck_result_reviews_valid_revision")),
        schema="app",
    )


def downgrade() -> None:
    op.drop_table("result_reviews", schema="app")
