from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

import httpx
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.ext.asyncio import async_sessionmaker

from saint_tibo.api.health import router as health_router
from saint_tibo.api.router import router as api_router
from saint_tibo.auth.jwt import TokenVerifier
from saint_tibo.core.config import Settings
from saint_tibo.core.errors import ErrorResponse, register_error_handlers
from saint_tibo.core.logging import RequestIdMiddleware, configure_logging
from saint_tibo.db.session import create_engine


def create_api(settings: Settings | None = None) -> FastAPI:
    config = settings if settings is not None else Settings()

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        configure_logging(config.log_level)
        engine = create_engine(config)
        app.state.settings = config
        app.state.engine = engine
        app.state.session_factory = async_sessionmaker(engine, expire_on_commit=False)
        try:
            async with httpx.AsyncClient(timeout=config.http_timeout_seconds) as client:
                app.state.token_verifier = TokenVerifier(config, client)
                yield
        finally:
            await engine.dispose()

    app = FastAPI(
        title="Saint Tibo API",
        version="0.1.0",
        lifespan=lifespan,
        responses={500: {"model": ErrorResponse}, 422: {"model": ErrorResponse}},
    )
    app.add_middleware(RequestIdMiddleware)
    register_error_handlers(app)
    app.include_router(health_router)
    app.include_router(api_router)
    return app


def create_app(settings: Settings | None = None) -> CORSMiddleware:
    config = settings if settings is not None else Settings()
    # Wrap ServerErrorMiddleware too, so browsers can read unexpected error responses.
    return CORSMiddleware(
        create_api(config),
        allow_origins=config.cors_origins,
        allow_credentials=False,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type", "X-Request-ID"],
        expose_headers=["X-Request-ID"],
    )
