"""Logging and request correlation."""

import logging
from contextvars import ContextVar
from uuid import uuid4

from starlette.types import ASGIApp, Message, Receive, Scope, Send

REQUEST_ID_HEADER = b"x-request-id"

_request_id: ContextVar[str] = ContextVar("request_id", default="-")


def request_id() -> str:
    """Correlation id of the request being handled, or `-` outside a request."""
    return _request_id.get()


class _RequestIdFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        record.request_id = _request_id.get()
        return True


def configure_logging(level: str) -> None:
    logging.basicConfig(
        level=level.upper(),
        format="%(asctime)s %(levelname)s %(name)s [%(request_id)s] %(message)s",
        force=True,
    )
    for handler in logging.getLogger().handlers:
        handler.addFilter(_RequestIdFilter())


class RequestIdMiddleware:
    """Accept or mint an `X-Request-ID`, expose it to logs and echo it back.

    Written as raw ASGI so it also covers responses produced by error handlers.
    """

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        incoming = dict(scope["headers"]).get(REQUEST_ID_HEADER)
        identifier = incoming.decode("latin-1")[:128] if incoming else uuid4().hex
        token = _request_id.set(identifier)

        async def send_with_request_id(message: Message) -> None:
            if message["type"] == "http.response.start":
                message["headers"] = [
                    *message["headers"],
                    (REQUEST_ID_HEADER, identifier.encode("latin-1")),
                ]
            await send(message)

        try:
            await self.app(scope, receive, send_with_request_id)
        finally:
            _request_id.reset(token)
