"""Keep the automatic draft on the existing result, separate from human revisions.

Revision ID: 0008
Revises: 0007
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0008"
down_revision: str | Sequence[str] | None = "0007"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "result_versions",
        sa.Column("extraction_draft", postgresql.JSONB(), nullable=True),
        schema="app",
    )


def downgrade() -> None:
    op.drop_column("result_versions", "extraction_draft", schema="app")
