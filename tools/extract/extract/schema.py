"""Bounded structured output and references; validity does not prove model quality."""

import json
from typing import Any


class ExtractionError(ValueError):
    """Safe error code and allowlisted metrics only, never generated content."""

    def __init__(self, code: str, metrics: dict | None = None):
        super().__init__(code)
        self.metrics = metrics or {}


_TEXT = {"type": "string", "minLength": 1, "maxLength": 500}
_REFS = {"type": "array", "items": {"type": "integer"}, "minItems": 1, "maxItems": 64}
_EVIDENCE = {
    "type": "object", "additionalProperties": False,
    "required": ["text", "source_segment_ids"],
    "properties": {"text": _TEXT, "source_segment_ids": _REFS},
}
_EXTRACTION_SCHEMA = {
    "type": "object", "additionalProperties": False,
    "required": ["action_items", "summary"],
    "properties": {
        "action_items": {
            "type": "array", "maxItems": 64,
            "items": {
                "type": "object", "additionalProperties": False,
                "required": ["text", "assignee_text", "due_text", "due_date", "source_segment_ids"],
                "properties": {
                    "text": _TEXT,
                    "assignee_text": {"type": ["string", "null"], "minLength": 1, "maxLength": 200},
                    "due_text": {"type": ["string", "null"], "minLength": 1, "maxLength": 200},
                    # hack: dates stay unknown until deterministic normalization is accepted.
                    "due_date": {"type": "null"},
                    "source_segment_ids": _REFS,
                },
            },
        },
        "summary": {
            "type": "object", "additionalProperties": False,
            "required": ["topics", "decisions", "open_questions"],
            "properties": {
                key: {"type": "array", "maxItems": 16, "items": _EVIDENCE}
                for key in ("topics", "decisions", "open_questions")
            },
        },
    },
}


def response_format() -> dict[str, Any]:
    return {"type": "json_schema", "json_schema": {
        "name": "meeting_extraction", "strict": True, "schema": _EXTRACTION_SCHEMA,
    }}


def _check(condition: bool) -> None:
    if not condition:
        raise ExtractionError("invalid_extraction_output")


def _text(value: Any, limit: int = 500) -> None:
    _check(isinstance(value, str))
    _check(1 <= len(value) <= limit and bool(value.strip()))
    _check(not any(ord(c) < 32 and c not in "\t\r\n" or 0xD800 <= ord(c) <= 0xDFFF
                   or ord(c) in (0xFFFE, 0xFFFF) for c in value))


def _evidence(value: dict, known: set[int]) -> None:
    _text(value["text"])
    ids = value["source_segment_ids"]
    _check(isinstance(ids, list) and 1 <= len(ids) <= 64)
    _check(all(type(i) is int for i in ids))
    _check(len(ids) == len(set(ids)) and set(ids) <= known)


def validate(payload: Any, known_segment_ids: set[int]) -> dict[str, Any]:
    _check(isinstance(payload, dict) and set(payload) == {"action_items", "summary"})
    items = payload["action_items"]
    _check(isinstance(items, list) and len(items) <= 64)
    for item in items:
        _check(isinstance(item, dict) and set(item) == {
            "text", "assignee_text", "due_text", "due_date", "source_segment_ids",
        })
        _evidence(item, known_segment_ids)
        for key in ("assignee_text", "due_text"):
            if item[key] is not None:
                _text(item[key], 200)
        # An explicit absence marker is not a deadline. Preserve all actual
        # relative/event-based phrases and leave attribution to human review.
        if item["due_text"] is not None and " ".join(item["due_text"].casefold().split()) in {
            "не указан", "срок не указан",
        }:
            item["due_text"] = None
        _check(item["due_date"] is None)
    summary = payload["summary"]
    _check(isinstance(summary, dict) and set(summary) == {"topics", "decisions", "open_questions"})
    for entries in summary.values():
        _check(isinstance(entries, list) and len(entries) <= 16)
        for entry in entries:
            _check(isinstance(entry, dict) and set(entry) == {"text", "source_segment_ids"})
            _evidence(entry, known_segment_ids)
    # Only exact repeats can be merged safely without another inference pass.
    merged: dict[tuple, dict] = {}
    for item in items:
        key = (item["text"].casefold().strip(), item["assignee_text"], item["due_text"])
        if key in merged:
            ids = set(merged[key]["source_segment_ids"]) | set(item["source_segment_ids"])
            _check(len(ids) <= 64)
            merged[key]["source_segment_ids"] = sorted(ids)
        else:
            merged[key] = item.copy()
    payload["action_items"] = list(merged.values())
    return payload


def _object(pairs: list[tuple]) -> dict:
    result = {}
    for key, value in pairs:
        _check(key not in result)
        result[key] = value
    return result


def parse_and_validate(raw_content: str, known_segment_ids: set[int]) -> dict[str, Any]:
    try:
        payload = json.loads(raw_content, object_pairs_hook=_object)
    except (ValueError, TypeError) as exc:
        raise ExtractionError("invalid_extraction_output") from exc
    return validate(payload, known_segment_ids)
