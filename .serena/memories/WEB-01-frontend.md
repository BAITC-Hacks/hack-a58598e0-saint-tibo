# WEB-01 Frontend baseline

## Current Behavior

- TanStack Start SPA under `frontend/src/`; thin route → page modules.
  Shared UI is vendored shadcn/Base UI; reuse existing auth and controls.
- `app/routes/`: protected `_app` shell/home placeholder, `/capture`
  (WEB-21), local/stored-media `/player` (WEB-19), synthetic `/transcript-demo`
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
- Dev34062c4 adds an explicitly synthetic `/player` sample (#98); all three
  locales distinguish generated tones/fictional dialogue from recorded speech.

## Known Gaps

- Artem owns #83/#84/#85 and wider UI/design/landing work; those branches
  are not integrated into audited dev. Home is still a placeholder.
- Mock meeting-level review/export routes (#85) differ from integrated
  version-scoped review/export (#13/#14); adapt to the generated contract.
  Review GET omits speakers/segments; load segments from the paginated API.
  Export is JWT-authenticated SDK fetch with `parseAs: "blob"`, not a bare link.
- Ivan's protected recording selector and rich player are integrated in dev
  `a2cfe28`; reported Ivan deploy passed HTTP probes, interactive QA is pending.
  Server transcript fetching and the full review/export flow remain separate.

Last commit: `34062c4726f8ca5647b3159ac3b26e92023aee57` (audited origin/dev, 2026-09-23; not a live assertion).
