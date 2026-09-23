# API-03 Local synthetic mock (#85)

`tools/mock-api/server.py` + `fixtures.json`: loopback-only Compose `mock`
profile, stdlib HTTP. `python tools/mock-api/smoke.py` checks main paths/failure.
`bun run mock:dev` (tools/mock-api/run-dev.ts) creates isolated local `.env`,
runs real Postgres/backend/auth + Vite with `VITE_API_MODE=mock` and mock media
proxy upstream. `docs/mock-api.md` is the runbook and draft contract table.

Browser `backendClient` routes only `/api/v1/meetings...` to mock in
`import.meta.env.DEV`; `/api/v1/me`, Better Auth and sessions stay real.
Production bundle rejects mock switch. Sample WAV and review are synthetic;
uploaded bytes are dropped, not read from recording storage. #11 result-version
and segment reads follow OpenAPI; draft review/export routes for #12–14 do not
enter production OpenAPI or generated SDK.
