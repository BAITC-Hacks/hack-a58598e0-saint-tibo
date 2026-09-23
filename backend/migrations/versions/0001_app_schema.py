"""Create the schema owned by the FastAPI backend."""

from alembic import op

revision: str = "0001"
down_revision: str | None = None
branch_labels: str | None = None
depends_on: str | None = None


def upgrade() -> None:
    op.execute("CREATE SCHEMA app")


def downgrade() -> None:
    # RESTRICT deliberately refuses to remove a schema containing unexpected tables.
    op.execute("DROP SCHEMA app RESTRICT")
