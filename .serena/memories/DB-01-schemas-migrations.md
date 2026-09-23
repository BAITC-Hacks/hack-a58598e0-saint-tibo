# DB-01 Schemas and migrations

## Current Behavior

| Schema | Owner | Migration files |
| --- | --- | --- |
| `auth` | Better Auth / Drizzle | `frontend/drizzle/auth/` |
| `app` | FastAPI / SQLAlchemy / Alembic | `backend/migrations/` |

- PostgreSQL is the source of truth. `bun run migrate` runs both migration
  tools; never use Drizzle for `app` or Alembic for `auth`.
- `0001_app_schema` creates the app schema; `0002_meetings` adds meetings,
  participants, recordings and recording_chunks (recording+sequence key).
- `0003_processing_jobs` adds durable jobs with idempotency/lease fields.
  `0004_transcript_versions` adds result_versions and segments, plus
  `target_stage` on jobs. Those two revisions are in dev, not main `62b137d`.
- ResultVersion stores one job link, revision/status/completed stage,
  language/duration/model provenance/segment count. Segment stores recording
  and result IDs, nullable speaker UUID, text and constrained interval.
- Meeting deletion cascades recordings and their jobs/results/segments.
  Recording file cleanup is coordinated by the meetings service.
- `backend/migrations/env.py` imports meetings/processing/results models,
  filters autogeneration to `app` and keeps the version table in `public`.
- `owner_id` is an opaque Better Auth user ID, not an FK into `auth`.
  FastAPI reads `auth` identity/session rows directly; there is no after-hook
  copying Better Auth users into an `app` user table.
- Parallel local databases need distinct Compose project/port/database values.

## Known Gaps

- No Speaker or ActionItem table is migrated in the audited tree.
- `0005_reviewed_results.py` is claimed by the #13/#14 worker as future
  additive work. Recheck migration graph and models after integration;
  an announced filename is not an applied server migration.
- Never infer server migration version from a Git branch tip. Read the
  coordinator's deployment and runtime evidence separately (NEXT-SESSION).

Last commit: `a2cfe28c10b214a8189b8c140d9d6b31167bf27a` (audited tree, 2026-09-23; not a live assertion).
