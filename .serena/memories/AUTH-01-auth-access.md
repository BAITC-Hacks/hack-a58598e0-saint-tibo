# AUTH-01 Auth and access map

Deep detail: `docs/access-control.md`. This is the orientation map.

## Session model

Better Auth (frontend server) owns accounts and cookie sessions in the
`auth` schema. App requests carry a 5-minute JWT: FastAPI verifies the
JWKS signature AND re-loads role/ban/session via `auth/identity.py` —
revocation and role changes apply on the next request. No token denylist;
the 5-min lifetime is the revocation window. `BETTER_AUTH_SECRET`
encrypts the JWT keys stored in DB.

## Permissions

- `backend/src/saint_tibo/auth/policy.py` — app roles → permissions.
  `admin` gets management permissions but does NOT bypass resource
  ownership; foreign objects answer 404, not 403.
- Public registration creates ordinary users only. First admin is
  granted outside the app: `bun run seed` (local) then
  `bun run admin:grant <email>`. Never seed on public servers.
- Frontend effective rights come from `GET /api/v1/me`
  (`shared/auth/permissions.ts`, `can.tsx`, `route-access.ts`).

## Dev-login (dev servers only)

Guarded auto-login for personal dev domains — see WEB-01 routes and
INFRA-01 deploy flags. Facts: `DEV_LOGIN_ENABLED` env (forced false on
prod, true only for the three dev domains via deploy.sh domain
allowlist); `dev-login.server.ts` requires configured HTTPS origin,
exact Origin/hostname match and same-origin POST; creates sessions only
for two dedicated dev identities (seeded by `auth-seed-dev` /
`bun run --cwd frontend seed:dev`), never resets real users.
Disposable credentials live in `docs/browser-testing.md` — the only
owner-approved credential exception; never production secrets.
