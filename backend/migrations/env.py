import asyncio

from alembic import context
from alembic.runtime.environment import NameFilterParentNames, NameFilterType
from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import create_async_engine

from saint_tibo.core.config import Settings
from saint_tibo.db.base import Base
from saint_tibo.modules.meetings import models as meeting_models  # noqa: F401
from saint_tibo.modules.processing import models as processing_models  # noqa: F401
from saint_tibo.modules.results import models as result_models  # noqa: F401

target_metadata = Base.metadata


def include_name(
    name: str | None, type_: NameFilterType, parent_names: NameFilterParentNames
) -> bool:
    if type_ == "schema":
        return name == "app"
    return True


def configure(connection: Connection | None = None, url: str | None = None) -> None:
    context.configure(
        connection=connection,
        url=url,
        target_metadata=target_metadata,
        include_schemas=True,
        include_name=include_name,
        version_table="saint_tibo_alembic_version",
        version_table_schema="public",
        compare_type=True,
        compare_server_default=True,
        literal_binds=connection is None,
    )
    with context.begin_transaction():
        context.run_migrations()


async def run_online() -> None:
    engine = create_async_engine(str(Settings().database_url), poolclass=pool.NullPool)
    try:
        async with engine.connect() as connection:
            await connection.run_sync(configure)
    finally:
        await engine.dispose()


if context.is_offline_mode():
    configure(url=str(Settings().database_url))
else:
    asyncio.run(run_online())
