# AUTH-01 Auth and access map

Deep detail: `docs/access-control.md`. This is the orientation map.

## Session model

Better Auth (frontend server) owns accounts and cookie sessions in the
`auth` schema. Wire mechanics (cookie → 5-min JWT → JWKS + per-request
identity re-check) — API-01 Request path. What matters here: no token
denylist, so the 5-min JWT lifetime IS the revocation window; role/ban
changes apply on the next API request.

## Permissions

- `backend/src/saint_tibo/auth/policy.py` — app roles → permissions.
  `admin` gets management permissions but does NOT bypass resource
  ownership; foreign objects answer 404, not 403.
- Public registration creates ordinary users only. Admin rights are
  granted outside the app: `bun run admin:grant <email>` promotes an
  existing account, creating it if needed; `bun run seed` only makes
  the local demo pair. Never seed on public servers.
- Frontend effective rights come from `GET /api/v1/me`
  (`shared/auth/permissions.ts`, `can.tsx`, `route-access.ts`).

## Dev-login (dev servers only)

Guarded auto-login for personal dev domains. Deploy/flag wiring —
INFRA-01; route files and navigation — WEB-01. Auth-side facts:
`dev-login.server.ts` requires configured HTTPS origin, exact
Origin/hostname match and same-origin POST; creates sessions only for
the two dedicated dev identities, never resets real users. Disposable
credentials — `docs/browser-testing.md` (owner-approved exception).
