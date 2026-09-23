"""Bounded provider output with evidence mapped to persisted segment IDs."""

from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator

from saint_tibo.modules.results.schemas import ReviewActionItem, ReviewSummary


class Evidence(BaseModel):
    model_config = ConfigDict(extra="forbid")

    text: str = Field(min_length=1, max_length=500)
    source_segment_ids: list[int] = Field(min_length=1, max_length=64)


class DraftAction(Evidence):
    assignee_text: str | None = Field(max_length=200)
    due_text: str | None = Field(max_length=200)
    due_date: None


class DraftSummary(BaseModel):
    model_config = ConfigDict(extra="forbid")

    topics: list[Evidence] = Field(max_length=16)
    decisions: list[Evidence] = Field(max_length=16)
    open_questions: list[Evidence] = Field(max_length=16)


class DraftOutput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    action_items: list[DraftAction] = Field(max_length=64)
    summary: DraftSummary

    @model_validator(mode="after")
    def nonblank(self) -> "DraftOutput":
        for row in [
            *self.action_items,
            *self.summary.topics,
            *self.summary.decisions,
            *self.summary.open_questions,
        ]:
            if not row.text.strip():
                raise ValueError("Blank extraction text")
        return self


TEXT: dict[str, Any] = {"type": "string", "minLength": 1, "maxLength": 500}
REFS: dict[str, Any] = {
    "type": "array",
    "items": {"type": "integer"},
    "minItems": 1,
    "maxItems": 64,
}
EVIDENCE: dict[str, Any] = {
    "type": "object",
    "additionalProperties": False,
    "required": ["text", "source_segment_ids"],
    "properties": {"text": TEXT, "source_segment_ids": REFS},
}
RESPONSE_FORMAT: dict[str, Any] = {
    "type": "json_schema",
    "json_schema": {
        "name": "meeting_extraction",
        "strict": True,
        "schema": {
            "type": "object",
            "additionalProperties": False,
            "required": ["action_items", "summary"],
            "properties": {
                "action_items": {
                    "type": "array",
                    "maxItems": 64,
                    "items": {
                        "type": "object",
                        "additionalProperties": False,
                        "required": [
                            "text",
                            "assignee_text",
                            "due_text",
                            "due_date",
                            "source_segment_ids",
                        ],
                        "properties": {
                            **EVIDENCE["properties"],
                            "assignee_text": {"type": ["string", "null"], "maxLength": 200},
                            "due_text": {"type": ["string", "null"], "maxLength": 200},
                            "due_date": {"type": "null"},
                        },
                    },
                },
                "summary": {
                    "type": "object",
                    "additionalProperties": False,
                    "required": ["topics", "decisions", "open_questions"],
                    "properties": {
                        key: {"type": "array", "maxItems": 16, "items": EVIDENCE}
                        for key in ("topics", "decisions", "open_questions")
                    },
                },
            },
        },
    },
}


def to_review(
    output: DraftOutput, segment_ids: list[UUID]
) -> tuple[list[ReviewActionItem], ReviewSummary]:
    def refs(indices: list[int]) -> list[UUID]:
        if len(set(indices)) != len(indices) or any(
            type(index) is not int or index < 0 or index >= len(segment_ids) for index in indices
        ):
            raise ValueError("Invalid source reference")
        return [segment_ids[index] for index in indices]

    items = [
        ReviewActionItem(
            text=row.text,
            assignee_text=row.assignee_text,
            due_text=row.due_text,
            due_date=None,
            source_segment_ids=refs(row.source_segment_ids),
        )
        for row in output.action_items
    ]
    evidence = [*output.summary.topics, *output.summary.decisions, *output.summary.open_questions]
    summary = ReviewSummary(
        topics=[row.text for row in output.summary.topics],
        decisions=[row.text for row in output.summary.decisions],
        open_questions=[row.text for row in output.summary.open_questions],
        source_segment_ids=list(
            dict.fromkeys(
                identifier for row in evidence for identifier in refs(row.source_segment_ids)
            )
        ),
    )
    return items, summary
