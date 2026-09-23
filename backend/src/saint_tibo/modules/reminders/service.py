"""A stateless inbox: dates and review state, not a second action-item store."""

from datetime import UTC, datetime
from uuid import NAMESPACE_URL, uuid5

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from saint_tibo.core.pagination import PageParams
from saint_tibo.modules.reminders.schemas import ReminderPage, ReminderRead

# Select the newest result BEFORE testing approval. Otherwise an unreviewed
# reprocessing result would accidentally resurrect an older approved protocol.
# One statement keeps the page and total on the same PostgreSQL snapshot.
_INBOX = text("""
    WITH ranked_results AS (
        SELECT v.id AS result_version_id, v.recording_id, v.revision, v.status,
               v.created_at, m.id AS meeting_id, m.title AS meeting_title, m.timezone,
               timezone(m.timezone, CAST(:now AS timestamptz))::date AS local_today,
               row_number() OVER (
                   PARTITION BY v.recording_id ORDER BY v.created_at DESC, v.id DESC
               ) AS position
        FROM app.result_versions v
        JOIN app.recordings r ON r.id = v.recording_id
        JOIN app.meetings m ON m.id = r.meeting_id
        WHERE m.owner_id = :owner_id
    ), current_actions AS (
        SELECT v.*, CAST(a.value->>'id' AS uuid) AS action_item_id,
               a.value->>'text' AS text,
               CAST(a.value->>'assignee_participant_id' AS uuid) AS assignee_participant_id,
               a.value->>'assignee_text' AS assignee_text,
               a.value->>'due_text' AS due_text,
               CAST(a.value->>'due_date' AS date) AS due_date,
               a.value->>'status' AS action_status
        FROM ranked_results v
        JOIN app.result_reviews review
          ON review.result_version_id = v.result_version_id AND review.revision = v.revision
        CROSS JOIN LATERAL jsonb_array_elements(review.payload->'action_items') a(value)
        WHERE v.position = 1 AND v.status = 'reviewed'
          AND review.payload->'reviewed' = 'true'::jsonb
    ), unique_actions AS (
        -- If the same stable action UUID was carried between recordings of one
        -- meeting, its newest confirmed occurrence wins, including done/no-date.
        SELECT DISTINCT ON (meeting_id, action_item_id) *
        FROM current_actions
        ORDER BY meeting_id, action_item_id, created_at DESC, result_version_id DESC
    ), eligible AS (
        SELECT *, CASE WHEN due_date < local_today THEN 'overdue' ELSE 'upcoming' END AS kind,
               due_date - local_today AS days_until_due
        FROM unique_actions
        WHERE action_status IN ('open', 'in_progress') AND due_date <= local_today + 1
    ), page AS (
        SELECT * FROM eligible
        ORDER BY due_date, meeting_id, action_item_id
        LIMIT :limit OFFSET :offset
    )
    SELECT page.*, totals.total
    FROM (SELECT count(*) AS total FROM eligible) totals
    LEFT JOIN page ON true
    ORDER BY page.due_date, page.meeting_id, page.action_item_id
""")


async def list_reminders(
    session: AsyncSession,
    owner_id: str,
    pagination: PageParams,
    *,
    now: datetime | None = None,
) -> ReminderPage:
    """Return a bounded page; the optional clock is internal, never an API parameter."""
    evaluated_at = now if now is not None else datetime.now(UTC)
    if evaluated_at.tzinfo is None or evaluated_at.utcoffset() is None:
        raise ValueError("Reminder evaluation requires a timezone-aware clock")
    evaluated_at = evaluated_at.astimezone(UTC)
    result = await session.execute(
        _INBOX,
        {"owner_id": owner_id, "now": evaluated_at, **pagination.model_dump()},
    )
    rows = result.mappings().all()
    items = []
    for row in rows:
        if row["action_item_id"] is None:
            continue
        identity = (
            f"saint-tibo:reminder:{row['meeting_id']}:{row['action_item_id']}:"
            f"{row['due_date'].isoformat()}:{row['kind']}"
        )
        items.append(ReminderRead.model_validate({**row, "id": uuid5(NAMESPACE_URL, identity)}))
    return ReminderPage(
        items=items,
        total=rows[0]["total"],
        evaluated_at=evaluated_at,
        **pagination.model_dump(),
    )
