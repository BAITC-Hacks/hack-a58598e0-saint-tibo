# INFRA-01 Environments and manual deployment

## Current Behavior

- Push deploys nothing; no repository CI workflow is present in this tree.
  Commands and topology: `scripts/{dev-deploy,deploy}.sh`,
  `compose.yaml`, `infra/Caddyfile`, `docs/dev-server.md`.

| SSH alias | HTTPS domain |
| --- | --- |
| `saint-prod` | `saint-tibo.win` |
| `saint-dev-danil` | `dev-danil.saint-tibo.win` |
| `saint-dev-ivan` | `dev-ivan.saint-tibo.win` |
| `saint-dev-artem` | `dev-artem.saint-tibo.win` |

- Each environment has independent DB, secrets and sessions.
- Dev deployment ships the current clean committed tree through
  `sh scripts/dev-deploy.sh saint-dev-<member>`. Redeploy integrated dev
  explicitly; an ancestry guard refuses unknown/divergent deployed history.
- Prod is Danil's operation: `sh scripts/deploy.sh saint-prod` requires
  checked-out `main` exactly equal to fetched `origin/main`.
- Only gateway ports 80/443 are public; app/DB host ports bind loopback.
  Caddy sends API/health/OpenAPI directly to backend; frontend owns auth/media.
- `processing-worker` has only internal `processing` network, read-only
  recording/model mounts, 4 CPU/6 GiB limits and a separate STT image.
  Prepare `models/small` before offline processing; see MODELS-01.
- Three exact dev domains enable guarded dev-login and the dedicated
  `auth-seed-dev` service. Production forces the flag off and skips seed.
- Server secrets live in `/opt/saint-tibo/.env` with mode 600 and are
  preserved on redeploy. `BETTER_AUTH_SECRET` protects persisted signing
  keys; don't casually replace it. Root `.env`, models and user data stay private.
- Authoritative deployed commit is the target of
  `/opt/saint-tibo/current`, not GitHub dev/main or a successful build.

## Known Gaps

- Current wave integration and deployment scheduling belong to the parent
  coordinator; no worker should replace another worker's live version.
- Dev `97e804e` integrates review/export and migration 0005; coordinator
  reports DEPLOY-OK/healthy/readiness there. Independent LIVE-OK is pending.
  Dev34062c4 additionally changes only player/frontend docs; deploy/UI gate
  precedes the user-authorized current-wave release to main/prod.
- Last independent Danil runtime evidence is `58ee537` in
  [#94](https://github.com/BAITC-Hacks/hack-a58598e0-saint-tibo/issues/94#issuecomment-5793355510).
  Through `f8cf4da` only docs/memories changed; dev `a2cfe28` also adds player
  code and is not proven deployed on Danil. Ivan's [#95 report](https://github.com/BAITC-Hacks/hack-a58598e0-saint-tibo/issues/95#issuecomment-5793559235)
  claims that exact commit deployed on his dev with HTTP probes, no interactive QA.
- Organizational controls, retention/backup proof and enterprise hardening
  remain separate issues; local model egress isolation is not total certification.

Last commit: `97e804ed7c941408ecf22145d72497214b5002c4` (audited tree, 2026-09-23; not a live assertion).
