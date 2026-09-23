"""Response schema for the extract stage and its referential validation.

Field names mirror the ActionItem draft in docs/meeting-contract.md.
Experimental fields (assigner_text, assignee_confidence, due_kind) are
candidates for the contract and are reported back to the contract issue.
"""

import json
import re
from typing import Any

ASSIGNEE_CONFIDENCE = ("named", "context", "assumed", "unknown", "department")
DUE_KIND = ("date", "interval", "event", "unknown", "none")

_EXTRACTION_SCHEMA: dict[str, Any] = {
    "type": "object",
    "additionalProperties": False,
    "required": ["action_items", "summary"],
    "properties": {
        "action_items": {
            "type": "array",
            "items": {
                "type": "object",
                "additionalProperties": False,
                "required": [
                    "text",
                    "assignee_text",
                    "assignee_confidence",
                    "assigner_text",
                    "due_text",
                    "due_kind",
                    "due_date",
                    "source_segment_ids",
                ],
                "properties": {
                    "text": {"type": "string", "minLength": 3, "maxLength": 500},
                    "assignee_text": {"type": ["string", "null"], "maxLength": 200},
                    "assignee_confidence": {"enum": list(ASSIGNEE_CONFIDENCE)},
                    "assigner_text": {"type": ["string", "null"], "maxLength": 200},
                    "due_text": {"type": ["string", "null"], "maxLength": 200},
                    "due_kind": {"enum": list(DUE_KIND)},
                    "due_date": {"type": ["string", "null"], "maxLength": 10},
                    "source_segment_ids": {
                        "type": "array",
                        "items": {"type": "integer"},
                        "minItems": 1,
                        "maxItems": 64,
                    },
                },
            },
            "maxItems": 64,
        },
        "summary": {
            "type": "object",
            "additionalProperties": False,
            "required": ["topics", "decisions", "risks", "open_questions"],
            "properties": {
                key: {
                    "type": "array",
                    "maxItems": 32,
                    "items": {
                        "type": "object",
                        "additionalProperties": False,
                        "required": ["text", "source_segment_ids"],
                        "properties": {
                            "text": {"type": "string", "minLength": 3, "maxLength": 500},
                            "source_segment_ids": {
                                "type": "array",
                                "items": {"type": "integer"},
                                "maxItems": 64,
                            },
                        },
                    },
                }
                for key in ("topics", "decisions", "risks", "open_questions")
            },
        },
    },
}


def response_format() -> dict[str, Any]:
    """OpenAI-compatible response_format for llama-server chat completions."""
    return {
        "type": "json_schema",
        "json_schema": {
            "name": "meeting_extraction",
            "strict": True,
            "schema": _EXTRACTION_SCHEMA,
        },
    }


_DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


class ExtractionError(ValueError):
    """Model output failed schema or referential validation."""


def _check(condition: bool, problem: str) -> None:
    if not condition:
        raise ExtractionError(problem)


def _validate_evidence(value: Any, field: str) -> None:
    _check(isinstance(value, dict), f"{field}: expected object")
    _check(set(value) == {"text", "source_segment_ids"}, f"{field}: unexpected keys {sorted(value)}")
    _check(isinstance(value["text"], str) and 3 <= len(value["text"]) <= 500, f"{field}.text: bad length")
    ids = value["source_segment_ids"]
    _check(isinstance(ids, list) and all(isinstance(i, int) for i in ids), f"{field}.source_segment_ids: bad type")


def validate(payload: Any, known_segment_ids: set[int]) -> dict[str, Any]:
    """Validate the model response shape and that all segment references exist."""
    _check(isinstance(payload, dict), "top level must be an object")
    _check(set(payload) == {"action_items", "summary"}, f"top level keys: {sorted(payload)}")
    items = payload["action_items"]
    _check(isinstance(items, list) and len(items) <= 64, "action_items must be a list")
    for index, item in enumerate(items):
        field = f"action_items[{index}]"
        _check(isinstance(item, dict), f"{field}: expected object")
        expected = {
            "text", "assignee_text", "assignee_confidence", "assigner_text",
            "due_text", "due_kind", "due_date", "source_segment_ids",
        }
        _check(set(item) == expected, f"{field}: unexpected keys {sorted(item)}")
        _check(isinstance(item["text"], str) and 3 <= len(item["text"]) <= 500, f"{field}.text: bad length")
        _check(
            item["assignee_text"] is None or isinstance(item["assignee_text"], str),
            f"{field}.assignee_text: bad type",
        )
        _check(item["assignee_confidence"] in ASSIGNEE_CONFIDENCE, f"{field}.assignee_confidence: bad value")
        if item["assignee_confidence"] == "unknown":
            _check(item["assignee_text"] is None, f"{field}: unknown must have null assignee_text")
        else:
            _check(bool(item["assignee_text"]), f"{field}: confidence requires assignee_text")
        _check(
            item["assigner_text"] is None or isinstance(item["assigner_text"], str),
            f"{field}.assigner_text: bad type",
        )
        _check(item["due_text"] is None or isinstance(item["due_text"], str), f"{field}.due_text: bad type")
        _check(item["due_kind"] in DUE_KIND, f"{field}.due_kind: bad value")
        _check(
            item["due_date"] is None or _DATE_RE.match(item["due_date"] or ""),
            f"{field}.due_date: must be ISO date or null",
        )
        _check(item["due_kind"] != "date" or item["due_date"], f"{field}: date kind without due_date")
        ids = item["source_segment_ids"]
        _check(isinstance(ids, list) and 1 <= len(ids) <= 64, f"{field}.source_segment_ids: bad list")
        _check(all(isinstance(i, int) for i in ids), f"{field}.source_segment_ids: bad type")
        missing = [i for i in ids if i not in known_segment_ids]
        _check(not missing, f"{field}: unknown segment ids {missing[:8]}")
    summary = payload["summary"]
    _check(isinstance(summary, dict), "summary must be an object")
    _check(set(summary) == {"topics", "decisions", "risks", "open_questions"}, f"summary keys: {sorted(summary)}")
    for key, entries in summary.items():
        _check(isinstance(entries, list) and len(entries) <= 32, f"summary.{key}: bad list")
        for index, entry in enumerate(entries):
            _validate_evidence(entry, f"summary.{key}[{index}]")
            missing = [i for i in entry["source_segment_ids"] if i not in known_segment_ids]
            _check(not missing, f"summary.{key}[{index}]: unknown segment ids {missing[:8]}")
    return payload


def parse_and_validate(raw_content: str, known_segment_ids: set[int]) -> dict[str, Any]:
    try:
        payload = json.loads(raw_content)
    except json.JSONDecodeError as exc:
        raise ExtractionError(f"invalid JSON: {exc.msg}") from exc
    return validate(payload, known_segment_ids)
