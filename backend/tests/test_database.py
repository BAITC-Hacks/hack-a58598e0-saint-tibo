import os
import subprocess

import pytest
from alembic.config import Config
from alembic.script import ScriptDirectory
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

pytestmark = pytest.mark.integration


async def test_migrations_and_auth_schema_isolation():
    url = os.environ.get("TEST_DATABASE_URL")
    if not url:
        pytest.skip("Set TEST_DATABASE_URL to a disposable PostgreSQL database")
    environment = {**os.environ, "BACKEND_DATABASE_URL": url}
    engine = create_async_engine(url)

    def alembic(*args):
        subprocess.run(["alembic", *args], env=environment, check=True, capture_output=True)

    try:
        async with engine.begin() as connection:
            await connection.execute(text("CREATE SCHEMA IF NOT EXISTS auth"))
            await connection.execute(text("CREATE TABLE auth.migration_sentinel (id integer)"))
            await connection.execute(text("INSERT INTO auth.migration_sentinel VALUES (1)"))
        alembic("upgrade", "head")
        alembic("check")
        head = ScriptDirectory.from_config(Config("alembic.ini")).get_current_head()
        async with engine.connect() as connection:
            assert (
                await connection.scalar(
                    text("SELECT version_num FROM public.saint_tibo_alembic_version")
                )
                == head
            )
        alembic("downgrade", "base")
        async with engine.connect() as connection:
            assert await connection.scalar(text("SELECT id FROM auth.migration_sentinel")) == 1
            assert (
                await connection.scalar(
                    text(
                        "SELECT count(*) FROM information_schema.schemata WHERE schema_name = 'app'"
                    )
                )
                == 0
            )
        alembic("upgrade", "head")
    finally:
        async with engine.begin() as connection:
            await connection.execute(text("DROP TABLE IF EXISTS auth.migration_sentinel"))
        await engine.dispose()
