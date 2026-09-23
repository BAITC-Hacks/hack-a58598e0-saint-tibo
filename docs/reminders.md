# In-app curator reminders

The meeting owner is its curator. `GET /api/v1/reminders` (`listReminders`)
refreshes that owner's inbox. It requires the existing bearer identity and
`meeting:read` permission; administrators do not gain access to another owner's
meetings. There is no external notification channel, background delivery,
push, read/acknowledgement state, or notification history. The UI polls this
endpoint while the application is open. Opening it again recomputes the inbox.

Only the newest result version **per recording**, ordered by `created_at` then
UUID, can supply reminders. Its current revision must have both the `reviewed`
result status and a matching saved review with `reviewed: true`. A new draft
result or an unconfirmed edit suppresses older confirmed revisions. Confirmation
after that edit restores reminders from the new content. Different recordings
can each contain confirmed actions; older versions of the same recording cannot.

An action needs an explicit `due_date` and status `open` or `in_progress`.
`done`, `cancelled`, missing dates, and deadlines beyond tomorrow are omitted.
Dates use the **current meeting timezone**: today and tomorrow are `upcoming`;
earlier dates are `overdue`. A deadline remains upcoming through its entire
local date and becomes overdue at the next local midnight. This is a calendar
day rule, not a rolling 24-hour timer. Text such as “soon” without a saved date
does not create a reminder.

The response is `ReminderPage`: `items`, `total`, `limit`, `offset`,
`evaluated_at` (UTC), `channel: "in_app"`, and
`curator_policy: "meeting_owner"`. `limit` defaults to 20 (1–100); `offset`
defaults to 0. Items sort by deadline, meeting UUID, action UUID. Every item
contains `id`, `meeting_id`, `meeting_title`, `recording_id`,
`result_version_id`, `revision`, `action_item_id`, `text`,
`assignee_participant_id`, `assignee_text`, `due_text`, `due_date`, `kind`,
`timezone`, and `days_until_due`. The three assignee/due-text fields are nullable.
All identity fields are UUIDs except the owner, which is taken from the session.

Reminder IDs deterministically combine meeting, stable action UUID, deadline,
and kind. Repeated refreshes do not write or append anything. Rescheduling,
completion, deletion, or unconfirmed editing removes the obsolete entry; a
changed deadline or transition to overdue produces a different ID. Review-only
changes do not churn IDs. If the same action UUID is carried across recordings
of one meeting, its newest confirmed result occurrence wins before filtering
for date/status. Clients replace the current page on refresh rather than append
notifications, and can use IDs as rendering keys.

No migration or new dependency is required. The query filters by owner, expands
the existing bounded review snapshots in PostgreSQL, deduplicates actions, and
returns a bounded page and count in one database snapshot. It does not copy
actions into a second mutable store. The public endpoint has no clock override.
