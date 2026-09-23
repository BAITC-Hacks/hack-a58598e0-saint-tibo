# DB-01 Schemas and migrations

PostgreSQL is SoT. Two schemas, two tools — never cross:

| Schema | Owner | Tool | Files |
| --- | --- | --- | --- |
| `auth` | Better Auth | Drizzle | `frontend/drizzle/auth/` |
| `app` | FastAPI | SQLAlchemy/Alembic | `backend/migrations/` |

Rules: no FK from `app` to `auth` (user id is opaque `owner_id`);
`bun run migrate` runs both; new domain → autogenerate revision +
import models in `migrations/env.py`; parallel checkouts need unique
`COMPOSE_PROJECT_NAME`/`POSTGRES_PORT`/DB name in `.env`.

## Table state

- `main` (since PR #80): `0001_app_schema` +
  `0002_meetings` → `meetings`, `participants`, `recordings`,
  `recording_chunks` (PK (recording_id, sequence);
  start_ms/end_ms/sha256 per chunk).
- `dev` additionally: `0003_processing_jobs` → `processing_jobs`
  (status/stage/progress/attempt/request_key/lease — API-02) and
  `0004_transcript_versions` → `result_versions` + `segments`
  (`speaker_id` nullable until #12) + `target_stage` on jobs.
- Contract tables Speaker/ActionItem — not yet migrated; come with
  #12/#13.

## Auth → app sync

Better Auth commits to `auth` first; an `after`-hook projects the user
row into `app` (see `docs/access-control.md`). Role changes take effect
on the next FastAPI request (JWT 5-min + per-request identity re-check).
First admin: `bun run seed` + `bun run admin:grant <email>` — local only.
