from collections.abc import AsyncIterator
from typing import Annotated

from fastapi import Depends, Request
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, create_async_engine

from saint_tibo.core.config import Settings


def create_engine(settings: Settings) -> AsyncEngine:
    return create_async_engine(
        str(settings.database_url),
        hide_parameters=True,
        pool_pre_ping=True,
        pool_timeout=settings.database_timeout_seconds,
        connect_args={
            "timeout": settings.database_timeout_seconds,
            "command_timeout": settings.database_timeout_seconds,
        },
    )


async def get_session(request: Request) -> AsyncIterator[AsyncSession]:
    async with request.app.state.session_factory() as session:
        yield session


DatabaseSession = Annotated[AsyncSession, Depends(get_session)]
