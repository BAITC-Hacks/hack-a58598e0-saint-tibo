"""Persist anonymous speaker turns and model provenance per result version.

Revision ID: 0007
Revises: 0005
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0007"
down_revision: str | Sequence[str] | None = "0005"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "result_versions", sa.Column("diarization", postgresql.JSONB(), nullable=True), schema="app"
    )


def downgrade() -> None:
    op.drop_column("result_versions", "diarization", schema="app")
