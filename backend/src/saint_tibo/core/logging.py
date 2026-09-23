"""Logging and request correlation."""

import logging
import re
from contextvars import ContextVar
from copy import copy
from traceback import walk_tb
from types import TracebackType
from uuid import uuid4

from starlette.types import ASGIApp, Message, Receive, Scope, Send

REQUEST_ID_HEADER = b"x-request-id"

_request_id: ContextVar[str] = ContextVar("request_id", default="-")


def request_id() -> str:
    """Correlation id of the request being handled, or `-` outside a request."""
    return _request_id.get()


class _RequestIdFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        exception = record.exc_info[1] if record.exc_info else None
        record.request_id = getattr(exception, "_saint_request_id", _request_id.get())
        return True


class _SafeExceptionFormatter(logging.Formatter):
    """Keep exception types and frame locations, never messages, SQL or locals."""

    def format(self, record: logging.LogRecord) -> str:
        if record.exc_info or record.exc_text:
            record = copy(record)
            # Arguments and cached traceback text can already contain the exception.
            record.msg = "Unhandled exception"
            record.args = ()
            record.exc_text = None
            record.stack_info = None
        return super().format(record)

    def formatException(
        self,
        ei: tuple[type[BaseException] | None, BaseException | None, TracebackType | None],
    ) -> str:
        lines = ["Exception chain (messages and source lines omitted):"]
        exception = ei[1]
        seen: set[int] = set()
        while exception is not None and id(exception) not in seen:
            seen.add(id(exception))
            lines.append(f"{type(exception).__module__}.{type(exception).__qualname__}")
            for frame, lineno in walk_tb(exception.__traceback__):
                code = frame.f_code
                lines.append(f"  {code.co_filename}:{lineno} in {code.co_name}")
            exception = exception.__cause__ or (
                None if exception.__suppress_context__ else exception.__context__
            )
        return "\n".join(lines)


def configure_logging(level: str) -> None:
    logging.basicConfig(
        level=level.upper(),
        format="%(asctime)s %(levelname)s %(name)s [%(request_id)s] %(message)s",
        force=True,
    )
    for handler in logging.getLogger().handlers:
        handler.addFilter(_RequestIdFilter())
        handler.setFormatter(
            _SafeExceptionFormatter(
                "%(asctime)s %(levelname)s %(name)s [%(request_id)s] %(message)s"
            )
        )
    # Uvicorn otherwise logs ServerErrorMiddleware's rethrow through its own
    # unsanitized handler even after the API has sent a generic 500 response.
    for name in ("uvicorn", "uvicorn.error", "uvicorn.access"):
        server_logger = logging.getLogger(name)
        server_logger.handlers.clear()
        server_logger.propagate = True


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
        candidate = incoming.decode("latin-1") if incoming else ""
        identifier = (
            candidate if re.fullmatch(r"[A-Za-z0-9._:-]{1,128}", candidate) else uuid4().hex
        )
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
        except Exception as exc:
            # The outer error handler and Uvicorn run after this context resets.
            exc._saint_request_id = identifier  # type: ignore[attr-defined]
            raise
        finally:
            _request_id.reset(token)
