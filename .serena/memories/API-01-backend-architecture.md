# API-01 Backend architecture

## Current Behavior

- FastAPI lives in `backend/src/saint_tibo/`: shared `api/`, `auth/`,
  `core/`, `db/`, then `modules/{meetings,processing,results,exports}/`.
- `infra/Caddyfile` sends same-origin `/api/v1/*`, health and OpenAPI/docs
  directly to FastAPI. Other routes reach TanStack Start, including Better
  Auth and the cookie-authenticated media proxy (AUTH-01, API-02).
- `api/router.py` mounts meetings, processing and read-only results.
  Exports currently provides render functions; it has no mounted HTTP router.
- Pattern: module `models/schemas/service/router.py`, module service functions,
  permissions in `auth/policy.py`, model registration in `migrations/env.py`.
  See `docs/conventions.md` before adding a domain; no repository layer.
- Wire truth: `contracts/openapi.json` and generated frontend SDK.
  Regenerate via `bun run api:generate`; never hand-edit generated types.
- UUID IDs, snake_case JSON, camelCase operation IDs; UTC RFC3339 timestamps.
  Errors use `{"error":{"code","message","details"}}`; codes are snake_case.
- Lists use `{items,total,limit,offset}`, default limit 20/max 100.
  Entity lists are newest-first; transcript segments are timeline-ordered.
- PATCH conventions use `PartialUpdate` with nonnullable-field guards.
  Resource ownership stays server-side; foreign resources return 404,
  including when the caller is an admin.

## Known Gaps

- Drafts in `docs/meeting-contract.md` and UI mocks are not shipped endpoints.
- Processing/results details: [API-10](API-10-processing-results.md).
  Reviewed persistence and HTTP export: [API-13](API-13-review-export.md).
- Auth is database-backed on each request; no copied app user table or
  independent five-minute logout window exists (AUTH-01, DB-01).

Last commit: `f8cf4dae60e29c64a35a477e46673379c834cadd` (audited tree, 2026-09-23; not a live assertion).
