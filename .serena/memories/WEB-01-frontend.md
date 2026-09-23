# WEB-01 Frontend baseline

TanStack Start SPA, one origin with auth. Conventions:
`docs/conventions.md` + `docs/product-baseline.md` (branding points).

## Structure

- Routes `src/app/routes/`: `__root`, `_app` shell + `_app.index`
  (home/meetings placeholder), `login`, `api/auth/$` (Better Auth
  catch-all), `api/media/meetings/$meetingId/recordings/$recordingId`
  (same-origin media proxy — on main since 62b137d).
- Server code `src/app/server/`: `auth.server.ts` (Better Auth),
  `auth-guards.server.ts`, `media.server.ts` (cookie→JWT media proxy).
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

## Open UI lanes (Artem)

#16 branding/visual contract, #17 meeting list/create/progress,
#18 transcript/participants/action items/export views,
#40–43 landing, #44–48 design tokens/DESIGN.md/shared UI/Storybook/FSD.
Home page currently says "processing not connected" — honest placeholder,
keep it truthful until APIs land.
