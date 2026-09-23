"""Owner-scoped participant questions backed by self-hosted Honcho."""

import base64
import hashlib
import hmac
import json
from typing import Annotated, Any

import httpx
from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, Field
from sqlalchemy import select

from saint_tibo.auth.dependencies import require_permissions
from saint_tibo.auth.policy import Permission
from saint_tibo.auth.schemas import CurrentUser
from saint_tibo.core.errors import APIError, ErrorResponse
from saint_tibo.db.session import DatabaseSession
from saint_tibo.modules.meetings.models import Meeting, Participant

router = APIRouter(
    prefix="/org/questions",
    tags=["organization"],
    responses={code: {"model": ErrorResponse} for code in (401, 403, 503)},
)
ReadUser = Annotated[CurrentUser, Depends(require_permissions(Permission.MEETING_READ))]


class Question(BaseModel):
    query: str = Field(min_length=3, max_length=500)


class Answer(BaseModel):
    answer: str
    meeting_count: int
    participant_count: int
    provider: str = "honcho"


def _token(secret: str, *, workspace: str | None = None, admin: bool = False) -> str:
    def encode(data: bytes) -> str:
        return base64.urlsafe_b64encode(data).rstrip(b"=").decode()

    header = encode(b'{"alg":"HS256","typ":"JWT"}')
    claims = {"t": "", "ad": admin}
    if workspace is not None:
        claims["w"] = workspace
    body = encode(json.dumps(claims, separators=(",", ":")).encode())
    signature = encode(
        hmac.new(secret.encode(), f"{header}.{body}".encode(), hashlib.sha256).digest()
    )
    return f"{header}.{body}.{signature}"


async def _honcho(
    client: httpx.AsyncClient,
    method: str,
    path: str,
    token: str,
    body: dict[str, Any] | None = None,
) -> dict[str, Any]:
    try:
        response = await client.request(
            method, path, headers={"Authorization": f"Bearer {token}"}, json=body
        )
        response.raise_for_status()
        payload = response.json()
    except (httpx.HTTPError, ValueError) as exc:
        # No request or response body in logs: names and questions are private.
        raise APIError(
            503, "honcho_unavailable", "Organizational questions are temporarily unavailable"
        ) from exc
    if not isinstance(payload, dict):
        raise APIError(
            503, "honcho_invalid_response", "Organizational questions are temporarily unavailable"
        )
    return payload


@router.post("", operation_id="askOrganizationQuestion")
async def ask_organization_question(
    body: Question, request: Request, session: DatabaseSession, user: ReadUser
) -> Answer:
    config = request.app.state.settings
    if not config.honcho_url or not config.honcho_jwt_secret:
        raise APIError(503, "honcho_not_configured", "Organizational questions are not configured")

    # The sole data source is owner-filtered app data. A workspace token cannot cross owners.
    meetings = list(
        await session.scalars(
            select(Meeting).where(Meeting.owner_id == user.id).order_by(Meeting.id).limit(100)
        )
    )
    if not meetings:
        return Answer(
            answer="Нет доступных встреч и участников для ответа.",
            meeting_count=0,
            participant_count=0,
        )
    meeting_ids = [row.id for row in meetings]
    participants = list(
        await session.scalars(
            select(Participant)
            .where(Participant.meeting_id.in_(meeting_ids))
            .order_by(Participant.id)
            .limit(500)
        )
    )
    if not participants:
        return Answer(
            answer="В доступных встречах пока нет участников.",
            meeting_count=len(meetings),
            participant_count=0,
        )

    workspace = "st-" + hashlib.sha256(user.id.encode()).hexdigest()[:32]
    admin = _token(config.honcho_jwt_secret, admin=True)
    scoped = _token(config.honcho_jwt_secret, workspace=workspace)
    by_meeting: dict[str, list[Participant]] = {}
    for person in participants:
        by_meeting.setdefault(str(person.meeting_id), []).append(person)
    async with httpx.AsyncClient(base_url=config.honcho_url.rstrip("/"), timeout=30) as client:
        await _honcho(client, "POST", "/v3/workspaces", admin, {"id": workspace})
        for meeting in meetings:
            rows = by_meeting.get(str(meeting.id), [])
            if not rows:
                continue
            meeting_key = f"meeting-{meeting.id}"
            await _honcho(
                client, "POST", f"/v3/workspaces/{workspace}/peers", scoped, {"id": "directory"}
            )
            await _honcho(
                client,
                "POST",
                f"/v3/workspaces/{workspace}/sessions",
                scoped,
                {"id": meeting_key, "peers": {"directory": {}}},
            )
            seen: set[str] = set()
            for page in range(1, 12):
                listing = await _honcho(
                    client,
                    "POST",
                    f"/v3/workspaces/{workspace}/sessions/{meeting_key}/messages/list?page={page}&size=100",
                    scoped,
                    {"filters": {}},
                )
                items = listing.get("items", [])
                if not isinstance(items, list):
                    raise APIError(
                        503,
                        "honcho_invalid_response",
                        "Organizational questions are temporarily unavailable",
                    )
                seen.update(
                    source
                    for item in items
                    if isinstance(item, dict) and isinstance(item.get("metadata"), dict)
                    if isinstance(source := item["metadata"].get("source_id"), str)
                )
                if len(items) < 100:
                    break
            pending = []
            for person in rows:
                source_id = f"participant-{person.id}"
                if source_id in seen:
                    continue
                pending.append(
                    {
                        "content": (
                            f"Участник: {person.display_name}. "
                            f"Роль: {person.role or 'не указана'}. "
                            f"Встреча: {meeting.title}."
                        ),
                        "peer_id": "directory",
                        "metadata": {"source_id": source_id},
                    }
                )
            if pending:
                await _honcho(
                    client,
                    "POST",
                    f"/v3/workspaces/{workspace}/sessions/{meeting_key}/messages",
                    scoped,
                    {"messages": pending},
                )
        reply = await _honcho(
            client,
            "POST",
            f"/v3/workspaces/{workspace}/chat",
            scoped,
            {
                "query": body.query,
                "reasoning_level": "minimal",
                "include_evidence": False,
                "stream": False,
            },
        )
    content = reply.get("content")
    if not isinstance(content, str) or not content.strip():
        raise APIError(503, "honcho_empty_answer", "Organizational answer is not ready")
    return Answer(
        answer=content.strip(), meeting_count=len(meetings), participant_count=len(participants)
    )
