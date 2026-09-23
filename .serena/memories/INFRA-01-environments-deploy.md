# INFRA-01 Environments and manual deploy

No CI/CD. Push deploys nothing. Doc: `docs/dev-server.md`.

## Servers

| Env | SSH alias | URL |
| --- | --- | --- |
| Production | `saint-prod` | https://saint-tibo.win |
| Danil | `saint-dev-danil` | https://dev-danil.saint-tibo.win |
| Ivan | `saint-dev-ivan` | https://dev-ivan.saint-tibo.win |
| Artem | `saint-dev-artem` | https://dev-artem.saint-tibo.win |

Independent DBs, secrets, sessions, TLS. Session on one env ≠ access
to another. Dev-server CPU/RAM inventory for model sizing lives in
`docs/stt-feasibility.md`.

## Deploy flow

Dev: `sh scripts/dev-deploy.sh saint-dev-<you>` from a clean checkout —
ships tracked files of the current commit, builds images, runs
migrations, waits for health, checks HTTPS. After merging to `dev`,
redeploy from fresh `dev` manually.
Deployment refuses unknown/diverged current-server commits: publish and
merge that history before replacing a colleague's running version.

The three dev aliases enable `DEV_LOGIN_ENABLED=true` and run the guarded
`auth-seed-dev` Compose service. It creates only the two dedicated dev
identities; account collisions fail without resetting real users.
Credentials and browser entry points: `docs/browser-testing.md`.

Prod (Danil only): `git switch main && git pull --ff-only origin main`
then `sh scripts/deploy.sh saint-prod`. Script requires local `main` ==
`origin/main`; it never merges or pushes.
Production forces `DEV_LOGIN_ENABLED=false` and never runs dev seed.
The auth server additionally requires an exact configured HTTPS dev origin.

## Topology and secrets

Only the Caddy gateway is public (pinned digest in stack-pin.json);
Postgres/API/frontend bind loopback, talk over a Docker network.
Same HTTPS origin serves `/api/v1/*`, `/health/*`, `/docs`, and
`/api/auth/*` (Better Auth inside frontend).

Server secrets generated on first run → `/opt/saint-tibo/.env` (mode
600), preserved on redeploy. Root `.env` is local-only and gitignored.
`BETTER_AUTH_SECRET` encrypts JWT keys in DB — never lose/rotate casually.

User-uploaded recordings: `recording_storage_path`
(default `backend/../.data/recordings`), on server inside the app env —
not in git, not world-readable (incoming dir 0700).
