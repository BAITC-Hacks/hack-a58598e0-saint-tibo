# AUTH-01 Auth and access

## Current Behavior

- Better Auth in `frontend/src/app/server/auth.server.ts` owns accounts,
  sessions and keys in PostgreSQL `auth`; Drizzle owns their migrations.
- Cookie-authenticated `/api/auth/token` issues a five-minute Ed25519 JWT
  with `sid`. FastAPI verifies JWKS signature, issuer and audience.
- Every protected request then calls `auth/identity.py::load_current_user`,
  joining `auth."user"` to `auth.session` by user/session IDs and expiry.
  Logout/revocation takes effect on the next request even for an unexpired
  JWT: missing session → 401 `session_revoked`; active ban → 403.
- Role changes are read from DB on each request. No separate app user
  projection, token denylist or five-minute logout grace period is used.
- `auth/policy.py` grants explicit user/admin permissions. Admin does not
  bypass meeting ownership; foreign resource IDs give 404.
- Frontend effective permissions come from `GET /api/v1/me`;
  helpers are in `frontend/src/shared/auth/`.
- Public registration creates ordinary users. `bun run admin:grant <email>`
  is a separate administrative operation; local `bun run seed` creates
  demo accounts and must not be run on public servers.
- Guarded `POST /api/dev-login` creates sessions only for two dedicated
  dev identities, requires enabled flag, exact configured HTTPS dev origin
  and same-origin checks. Dedicated seed refuses account collisions.
  Production disables this path. Details: `docs/access-control.md`,
  `docs/browser-testing.md`; deployment wiring: INFRA-01.
- `DEMO.md` separately documents deliberately public ordinary persistent demo
  credentials authorized by the owner. Preserve those identities; this does
  not authorize publishing infrastructure/admin/API secrets or enabling prod dev-login.

## Known Gaps

- Organization-level access, closed enrollment and SSO are future issues;
  current owner ACL is not a claim that those requirements are complete.
- [#94 live proof](https://github.com/BAITC-Hacks/hack-a58598e0-saint-tibo/issues/94#issuecomment-5793355510)
  includes immediate 401 after logout for old JWT/cookie, owner isolation
  and dev login. It does not replace the broader security acceptance backlog.

Last commit: `6ed682e734620ec6cc710ad59192350e3f46ed39` (audited core release tree, 2026-09-23; production 7d5b481 LIVE-OK; TEST-01).
