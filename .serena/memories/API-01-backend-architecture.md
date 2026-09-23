# API-01 Backend architecture

Canonical patterns: `docs/conventions.md` — read it before a new domain;
this note is the map, not a duplicate.

## Request path

Browser → same origin → TanStack server routes (`/api/auth/*` → Better
Auth; `/api/v1/*` + media → FastAPI). Better Auth cookie → short-lived
JWT (5 min) → FastAPI verifies JWKS signature AND re-checks
role/ban/session via `auth/identity.py` every request — revoked session
dies on next API call. `BETTER_AUTH_SECRET` protects JWT keys in DB.

## Module recipe (per `docs/conventions.md`)

`modules/<domain>/{models,schemas,service,router}.py` → permission in
`auth/policy.py` → mount in `api/router.py` → import models in
`migrations/env.py` → `alembic revision --autogenerate` → `bun run migrate`
→ `bun run api:generate`. Service = module functions, no repository layer;
writer ends `await session.commit()`.

## Contracts

- Errors: `APIError(status, code, message)` → `{"error":{code,message,details}}`,
  codes snake_case; `responses={401,403,404}` in decorator.
- Lists: `{items,total,limit,offset}`, limit default 20 max 100,
  order `created_at DESC, id DESC`.
- IDs all UUID; `operation_id` camelCase; JSON snake_case;
  PATCH via `PartialUpdate` + `NON_NULLABLE` + `.changes()`.
- Ownership enforced server-side; other user's object → 404, admin does
  NOT bypass ownership. Timestamps RFC 3339, server returns UTC.
- Unauthorized → 401. Mixins: `UUIDPrimaryKey`, `OwnedByUser`, `Timestamps`.

## State on `main`

Auth, `/api/v1/me`, `/api/v1/admin/access`, `/health/*`, plus the full
meetings surface (meetings/participants/recordings/chunks/finalize/media
— see API-02). Next domain work: jobs (#10) then STT (#11)+.
`contracts/openapi.json` is the truth of what's implemented;
docs drafts ≠ endpoints.
