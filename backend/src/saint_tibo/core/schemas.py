"""Shared DTO building blocks.

Do not put `strict=True` on a request DTO: strict mode rejects the JSON string `"todo"` for
an enum field and answers 422 for a perfectly valid request. It is safe on response-only
models such as `auth.schemas.CurrentUser`.
"""

from typing import Any, ClassVar, Self

from pydantic import BaseModel, ConfigDict, model_validator


class ReadModel(BaseModel):
    """Response DTO validated straight from an ORM object."""

    model_config = ConfigDict(from_attributes=True)


class PartialUpdate(BaseModel):
    """Base for PATCH bodies.

    Keys absent from the request are left untouched. An explicit `null` clears a nullable
    column, and is rejected for the columns listed in `NON_NULLABLE` — without this, PATCH
    `{"title": null}` reaches the database and fails with a NOT NULL violation.
    """

    NON_NULLABLE: ClassVar[tuple[str, ...]] = ()

    @model_validator(mode="after")
    def _reject_null_for_required_columns(self) -> Self:
        nulled = [
            field
            for field in self.NON_NULLABLE
            if field in self.model_fields_set and getattr(self, field) is None
        ]
        if nulled:
            raise ValueError(f"Cannot be null: {', '.join(nulled)}")
        return self

    def changes(self) -> dict[str, Any]:
        """Only the fields the request actually sent."""
        return self.model_dump(exclude_unset=True)
