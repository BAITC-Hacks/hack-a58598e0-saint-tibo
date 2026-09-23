# WEB-01 Frontend baseline

TanStack Start SPA, one origin with auth. Conventions:
`docs/conventions.md` + `docs/product-baseline.md` (branding points).

## Structure

- Routes `src/app/routes/`: `__root`, `_app` shell + `_app.index`
  (home/meetings placeholder), `login`, `dev-login` + `api/dev-login`
  (guarded dev auto-login — AUTH-01), `api/auth/$` (Better Auth
  catch-all), `api/media/meetings/$meetingId/recordings/$recordingId`
  (same-origin media proxy — on main).
- Server code `src/app/server/`: `auth.server.ts` (Better Auth),
  `auth-guards.server.ts`, `media.server.ts` (cookie→JWT media proxy).
- Dev entry: `_app` auto-logs in a dev user via `POST /api/dev-login`
  when unauthenticated; `/dev-login?role=admin` is explicit admin entry;
  `?auth=manual` skips auto-login for that navigation; `/login` stays
  manual. Server guards/accounts — AUTH-01.
- Pages `src/pages/<slice>/{index.ts,ui/}` — thin route → page import.
- `src/shared/api/generated/` — SDK from `contracts/openapi.json` via
  `bun run api:generate`; NEVER hand-edit or hand-write API types.
- `src/shared/auth/`: `permissions.ts`, `can.tsx`, `route-access.ts`,
  `admin-access.ts`; effective rights from `GET /api/v1/me`.
- `src/shared/ui/` — vendored shadcn/Base UI; reuse, don't fork.

## Rules

Strings: only `messages/{ru,kk,en}.json`, add via
`bun run --cwd frontend i18n:add <key> "<ru>" "<kk>" "<en>"`.
Brand assets local (`frontend/public/`) — no required external CDN.
Baseline forbids fake counters/static demos before real backend data.
Media playback (#19/#20, Ivan): HTMLMediaElement + same-origin
`/api/media/...` URL (see API-02).

## UI lanes

UI/UX, branding, landing and design-system work is Artem's lane —
live list in `gh issue list --assignee letya999`. Placeholder states
stay honest: no static demo data passed off as processing results
(product-baseline rule).
