# STACK-01 Stack and repository layout

## Current Behavior

- `build/stack-pin.json` owns stack decisions; exact packages are in locks.
  Runtime: Bun 1.4.2, Python >=3.13,<3.14, uv 0.12.13.
- `frontend/`: React 19.3, TanStack Start SPA/Router/Query, TypeScript 7.0.2,
  Vite 8.3, Tailwind, vendored shadcn/Base UI, react-hook-form and Zod 4.
  RU/KK/EN dictionaries: `frontend/messages/{ru,kk,en}.json` and canonical
  meeting-workspace `lib/{ru,kk,en}.ts`; preserve existing localization ownership.
- `backend/src/saint_tibo/`: FastAPI, SQLAlchemy/Alembic, shared API/auth/
  core/db modules and domain modules. Backend Python packages use uv only.
- PostgreSQL schemas: Better Auth/Drizzle owns auth, Alembic owns app (DB-01).
- `contracts/openapi.json` → `frontend/src/shared/api/generated/`;
  generator environment `tools/api-client/` intentionally uses TS6.
- `tools/transcribe/`: separate offline STT environment (MODELS-01).
  `tools/meeting-capture/`: kernel/platform prototypes (INFRA-22).
- `tools/mock-api/`: explicit Vite DEV synthetic backend (API-03).
  `tools/honcho/`: isolated hardened stack, not app-active (INFRA-23).
  `research/`: archived sources/findings, not implementation authority.
- `scripts/`: manual deployment and offline STT benchmark.
  `input-audio/`: explicitly owner-approved case fixtures, not user uploads.
- Root commands: `bun run setup` installs/configures local environment;
  `dev` starts stack; `build` builds frontend+backend; `migrate` runs both
  schema tools; `api:generate` rebuilds contract/client.
- `bun run verify` includes check + test + build. It is not a build-only
  command and must not be used under this wave's no-suite instruction.
- Disallowed defaults: Next.js, pnpm/npm/yarn, TS6 in frontend, duplicate
  JS package-manager locks and Drizzle ownership of app.

## Known Gaps

- Checked-in command/test availability does not authorize running suites;
  current wave proof is build and targeted actual scenarios (TEST-01).
- Unmerged worker features and their dependencies are not this stack.
  Check GitHub refs/claims and NEXT-SESSION before selecting a work area.

Last commit: `6ed682e734620ec6cc710ad59192350e3f46ed39` (audited core release tree, 2026-09-23; production 7d5b481 LIVE-OK; TEST-01).
