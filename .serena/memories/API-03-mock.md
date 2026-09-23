# API-03 Local synthetic mock (#85)

## Current Behavior

- `tools/mock-api/server.py` + `fixtures.json`: loopback-only Compose
  mock profile, stdlib HTTP; `smoke.py` contains synthetic path/failure checks.
- `bun run mock:dev` (`tools/mock-api/run-dev.ts`) creates isolated local
  env and starts real PostgreSQL/backend/auth plus Vite with VITE_API_MODE=mock
  and mock media upstream. Runbook/contract: `docs/mock-api.md`.
- `frontend/src/shared/api/backend-client.ts` redirects only meeting paths
  when import.meta.env.DEV and mock mode are both true. /me, Better Auth and
  sessions stay real; production/preview rejects the mock switch.
- Sample WAV/review are explicit synthetic fixtures; upload bytes are dropped.
  Result/segment read fixtures follow OpenAPI; draft meeting-level review/
  export routes never enter production OpenAPI or generated SDK.
- Canonical workspace adapts real version-scoped review/export separately
  in `pages/meeting-workspace/api/review.ts` (WEB-01, API-13).
  Its mock banner distinguishes source=mock from real persisted results.

## Known Gaps

- Local fixture behavior is not production API, STT, model quality or live proof.
  Do not enable mock mode in a release or use it as fallback on real API failure.
- Preserve Artem's mock/UI ownership and existing separation from real auth.
  This memory refresh does not rerun mock verification scripts.

Last commit: `6ed682e734620ec6cc710ad59192350e3f46ed39` (audited core release tree, 2026-09-23; production 7d5b481 LIVE-OK; TEST-01).
