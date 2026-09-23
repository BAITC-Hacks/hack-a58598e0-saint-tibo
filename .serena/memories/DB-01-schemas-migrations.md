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
  `target_stage` on jobs. Pinned core release 6ed682e ends at 0005.
- ResultVersion stores one job link, revision/status/completed stage,
  language/duration/model provenance/segment count. Segment stores recording
  and result IDs, nullable speaker UUID, text and constrained interval.
- `0005_reviewed_results.py` adds `app.result_reviews` with composite PK
  `(result_version_id, revision)`, revision >=2 and bounded JSONB payload.
  It freezes manual action items, summary, meeting/participant metadata and
  approval state; API saves append snapshots, never edits an old revision.
- Meeting deletion cascades recordings, jobs/results/segments and reviews.
  Recording file cleanup is coordinated by the meetings service.
- `backend/migrations/env.py` imports meetings/processing/results models,
  filters autogeneration to `app` and keeps the version table in `public`.
- `owner_id` is an opaque Better Auth user ID, not an FK into `auth`.
  FastAPI reads `auth` identity/session rows directly; there is no after-hook
  copying Better Auth users into an `app` user table.
- Parallel local databases need distinct Compose project/port/database values.

## Known Gaps

- No Speaker or normalized ActionItem table exists. Manual action items are
  in review JSONB; #15 backend 0972e69 is ready, stateless/no migration; UI pending.
- Initial review revision=1 is synthesized while current and not archived;
  saved history begins at revision=2. Reprocessing creates another version.
- Newer dev 269fcbb includes #12 migration 0007 and #69 extraction 0008→0007
  via 63a34f8; neither is deployed or part of core 6ed682e. Do not import old
  #69 feature 0006 or treat the newer dev migrations as live schema.
- Never infer server migration version from a Git branch tip. Read the
  coordinator's deployment and runtime evidence separately (NEXT-SESSION).

Last commit: `6ed682e734620ec6cc710ad59192350e3f46ed39` (audited core release tree, 2026-09-23; production 7d5b481 LIVE-OK; TEST-01).
