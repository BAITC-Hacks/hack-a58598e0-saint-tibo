# STACK-01 Stack pins and repo layout

Law: `build/stack-pin.json`. Runtime: Bun 1.4.2, Python ≥3.13 <3.14
via uv 0.12.13 (uv.lock locked). Exact deps: lockfiles only.

## Layout

| Dir | Contents |
| --- | --- |
| `frontend/` | React 19, TanStack Start SPA + Router + Query, TS 7.0.2, Tailwind, shadcn vendored (`bun run ui:add`) + Base UI, react-hook-form + zod 4. i18n ru/kk/en via `messages/*.json` |
| `backend/src/saint_tibo/` | FastAPI ≥0.141; `api/` (router, health), `auth/` (JWT/JWKS, identity, policy), `core/` (config, errors, pagination), `db/` (base, mixins, session), `modules/<domain>/` |
| `backend/migrations/` | Alembic, schema `app` only |
| `frontend/drizzle/auth/` | Drizzle, schema `auth` only — Better Auth owns it |
| `contracts/openapi.json` | Checked API snapshot; regenerate, don't hand-edit |
| `tools/api-client/` | Isolated generator (TS 6 on purpose) |
| `tools/transcribe/` | Separate STT env: own Dockerfile/pyproject, `prepare_model.py` pins the CT2 model, `transcribe.py` = worker subprocess (MODELS-01) |
| `tools/meeting-capture/` | Capture kernel + Teams/Meet/Zoom browser adapters (INFRA-22) |
| `scripts/` | `deploy.sh`, `dev-deploy.sh`, `benchmark-stt.py` |
| `input-audio/` | Case fixtures (owner-approved exception, #32) |

## Commands (root)

`bun run setup` deps+env+PG+migrations · `dev` full stack · `build` ·
`verify` types+checks+build · `test:integration` disposable-PG auth/migrations ·
`api:generate` OpenAPI→TS SDK · `migrate` drizzle(auth)+alembic(app) ·
`seed` demo accounts (never on public servers) · `demo`/`demo:stop` Docker stack.

## do_not_use

next.js · pnpm/npm/yarn · TS6 in frontend · second JS lockfile ·
Drizzle over `app` schema. Frontend strings only via i18n files.
Audio/meeting text: local or self-hosted models only — no external API.
