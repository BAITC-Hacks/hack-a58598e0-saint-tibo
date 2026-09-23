import json
from types import SimpleNamespace
from unittest.mock import AsyncMock
from uuid import uuid4

import httpx
import pytest

from saint_tibo.core.errors import APIError
from saint_tibo.modules.extraction.schemas import DraftOutput, to_review
from saint_tibo.modules.extraction.service import (
    extract_existing,
    provider_draft,
    provider_settings,
)


def draft_payload(reference=0):
    return {
        "action_items": [
            {
                "text": "Подготовить отчёт",
                "assignee_text": None,
                "due_text": None,
                "due_date": None,
                "source_segment_ids": [reference],
            }
        ],
        "summary": {
            "topics": [{"text": "Отчёт", "source_segment_ids": [reference]}],
            "decisions": [],
            "open_questions": [],
        },
    }


def test_draft_maps_only_real_segment_ids():
    saved_id = uuid4()
    items, summary = to_review(DraftOutput.model_validate(draft_payload()), [saved_id])
    assert items[0].source_segment_ids == [saved_id]
    assert items[0].assignee_text is None
    assert summary.source_segment_ids == [saved_id]
    with pytest.raises(ValueError):
        to_review(DraftOutput.model_validate(draft_payload(1)), [saved_id])


def test_provider_requires_configuration(monkeypatch):
    for name in (
        "BACKEND_EXTRACTION_API_BASE_URL",
        "BACKEND_EXTRACTION_API_MODEL",
        "BACKEND_EXTRACTION_API_KEY",
    ):
        monkeypatch.delenv(name, raising=False)
    with pytest.raises(APIError) as error:
        provider_settings()
    assert error.value.code == "extraction_unavailable"


@pytest.mark.parametrize("revision, local_draft", [(2, None), (1, {"saved": True})])
async def test_existing_review_is_not_sent_to_provider_or_overwritten(
    monkeypatch, revision, local_draft
):
    get_version = AsyncMock(
        return_value=SimpleNamespace(revision=revision, extraction_draft=local_draft)
    )
    provider = AsyncMock()
    update = AsyncMock()
    monkeypatch.setattr("saint_tibo.modules.extraction.service.results.get_version", get_version)
    monkeypatch.setattr("saint_tibo.modules.extraction.service.provider_draft", provider)
    monkeypatch.setattr("saint_tibo.modules.extraction.service.results.update_review", update)
    with pytest.raises(APIError) as error:
        await extract_existing(None, "owner", uuid4(), uuid4(), uuid4())
    assert error.value.code == "extraction_already_exists"
    provider.assert_not_awaited()
    update.assert_not_awaited()


async def test_provider_validates_structured_completion_without_leaking_content(monkeypatch):
    monkeypatch.setenv("BACKEND_EXTRACTION_API_BASE_URL", "https://provider.example/v1")
    monkeypatch.setenv("BACKEND_EXTRACTION_API_MODEL", "test-model")
    monkeypatch.setenv("BACKEND_EXTRACTION_API_KEY", "private-test-key")
    seen = {}

    def handler(request):
        seen["url"] = str(request.url)
        seen["authorization"] = request.headers["authorization"]
        seen["request"] = json.loads(request.content)
        return httpx.Response(
            200,
            json={
                "choices": [
                    {"finish_reason": "stop", "message": {"content": json.dumps(draft_payload())}}
                ]
            },
        )

    original_client = httpx.AsyncClient

    def mock_client(*args, **kwargs):
        return original_client(*args, transport=httpx.MockTransport(handler), **kwargs)

    monkeypatch.setattr("saint_tibo.modules.extraction.service.httpx.AsyncClient", mock_client)
    output = await provider_draft("private transcript")
    assert output.action_items[0].text == "Подготовить отчёт"
    assert seen["url"] == "https://provider.example/v1/chat/completions"
    assert seen["authorization"] == "Bearer private-test-key"
    assert seen["request"]["response_format"]["type"] == "json_schema"
    assert seen["request"]["messages"][1]["content"] == "private transcript"


async def test_incomplete_provider_response_returns_safe_code(monkeypatch):
    monkeypatch.setenv("BACKEND_EXTRACTION_API_BASE_URL", "https://provider.example/v1")
    monkeypatch.setenv("BACKEND_EXTRACTION_API_MODEL", "test-model")
    monkeypatch.setenv("BACKEND_EXTRACTION_API_KEY", "private-test-key")
    original_client = httpx.AsyncClient

    def mock_client(*args, **kwargs):
        transport = httpx.MockTransport(
            lambda _: httpx.Response(
                200,
                json={
                    "choices": [
                        {"finish_reason": "length", "message": {"content": "sensitive fragment"}}
                    ]
                },
            )
        )
        return original_client(*args, transport=transport, **kwargs)

    monkeypatch.setattr("saint_tibo.modules.extraction.service.httpx.AsyncClient", mock_client)
    with pytest.raises(APIError) as error:
        await provider_draft("private transcript")
    assert error.value.code == "extraction_incomplete"
    assert "sensitive" not in error.value.message
