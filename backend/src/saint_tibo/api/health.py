import asyncio
import logging
from typing import Literal

from fastapi import APIRouter, Request
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncEngine

from saint_tibo.core.errors import APIError, ErrorResponse

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/health", tags=["health"])


class HealthResponse(BaseModel):
    status: Literal["ok"] = "ok"


@router.get("/live", operation_id="getLiveness")
async def liveness() -> HealthResponse:
    return HealthResponse()


@router.get("/ready", operation_id="getReadiness", responses={503: {"model": ErrorResponse}})
async def readiness(request: Request) -> HealthResponse:
    engine: AsyncEngine = request.app.state.engine
    try:
        async with asyncio.timeout(request.app.state.settings.database_timeout_seconds):
            async with engine.connect() as connection:
                await connection.execute(text("SELECT 1"))
    except (SQLAlchemyError, OSError, TimeoutError) as exc:
        logger.warning("Database readiness check failed: %s", type(exc).__name__)
        raise APIError(503, "database_unavailable", "Database is unavailable") from exc
    return HealthResponse()
