"""Offset pagination shared by list endpoints."""

from collections.abc import Sequence
from typing import Annotated, Any

from fastapi import Depends, Query
from pydantic import BaseModel
from sqlalchemy import Select, func, select
from sqlalchemy.ext.asyncio import AsyncSession

DEFAULT_LIMIT = 20
MAX_LIMIT = 100


class PageParams(BaseModel):
    limit: int
    offset: int


def page_params(
    limit: Annotated[int, Query(ge=1, le=MAX_LIMIT)] = DEFAULT_LIMIT,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> PageParams:
    """Flat `limit`/`offset` query parameters, so generated clients stay simple."""
    return PageParams(limit=limit, offset=offset)


Pagination = Annotated[PageParams, Depends(page_params)]


class Page[T](BaseModel):
    """One page of results plus the total number of matching rows."""

    items: list[T]
    total: int
    limit: int
    offset: int

    @classmethod
    def model_parametrized_name(cls, params: tuple[type[Any], ...]) -> str:
        # `PageNoteRead` reads better than Pydantic's default `Page[NoteRead]` in the
        # OpenAPI contract and in the generated client.
        return f"Page{params[0].__name__}"


async def paginate[M](
    session: AsyncSession, statement: Select[tuple[M]], params: PageParams
) -> tuple[Sequence[M], int]:
    """Return the requested slice of `statement` and the total row count."""
    total = await session.scalar(
        select(func.count()).select_from(statement.order_by(None).subquery())
    )
    rows = await session.scalars(statement.limit(params.limit).offset(params.offset))
    return rows.all(), total or 0
