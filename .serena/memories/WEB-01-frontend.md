# WEB-01 Frontend baseline

## Current Behavior

- TanStack Start SPA under `frontend/src/`; thin route → page modules.
  Shared UI is vendored shadcn/Base UI; reuse existing auth and controls.
- `app/routes/`: protected `_app` shell/home placeholder, `/capture`
  (WEB-21), local `/player` (WEB-19), public synthetic `/transcript-demo`
  (WEB-20), login/dev-login and auth/media server routes.
- Server modules in `app/server/` own Better Auth, auth guards, dev login
  and cookie→JWT media proxy. API requests use the generated backend client.
- Dev root entry auto-logs in an unauthenticated dedicated dev user;
  `/dev-login?role=admin` is explicit admin entry; `?auth=manual` skips
  auto-login for that navigation and `/login` remains manual (AUTH-01).
- `shared/api/generated/` derives from committed OpenAPI. Never hand-write
  API response types or invent an endpoint because a draft mock uses it.
- `shared/auth/` uses effective backend `/me` permissions.
- All visible text goes through `messages/{ru,kk,en}.json`; use the
  existing i18n script. Brand assets live locally under `frontend/public/`;
  app operation must not require an external font/image CDN.
- Baseline UI/branding contract: `docs/product-baseline.md`,
  `docs/conventions.md`. Static examples must not masquerade as real results.

## Known Gaps

- Artem owns #83/#84/#85 and wider UI/design/landing work; those branches
  are not integrated into audited dev. Home is still a placeholder.
- Mock meeting-level review/export routes (#85) differ from version-scoped
  backend work (#13/#14); reconcile through an adapter/generated contract.
- Ivan owns player/capture integration; current local demos do not prove
  the whole authenticated meeting→results→review→export flow.

Last commit: `f8cf4dae60e29c64a35a477e46673379c834cadd` (audited tree, 2026-09-23; not a live assertion).
