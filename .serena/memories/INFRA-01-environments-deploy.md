# INFRA-01 Environments and manual deployment

Latest release: [GPU/speakers/extraction/inbox delta](RELEASE-94-runtime-wave.md).
The core snapshot below retains its original audit boundary.

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
- Review/export LIVE 97e804e, duration/privacy LIVE b1e33cb and canonical
  browser PASS 6ed682e have distinct receipts (TEST-01); production 7d5b481 is LIVE-OK.
- Runtime model choice is explicit BACKEND_STT_MODEL_PATH; default small,
  prepared turbo supported with verified hashes/provenance. Do not infer the
  active server model from code default or a model preparation command.
- Production SHA: `7d5b48104b85c307eb6b794f90521347d8c179db`.
  Main merged pinned core 6ed682e via PR114 with identical tree;
  production LIVE-OK is recorded in TEST-01. Newer dev/#12 is outside this release.
  Honcho is a separate tools Compose stack and is not launched by app deployment.
- Organizational controls, retention/backup proof and enterprise hardening
  remain separate issues; local model egress isolation is not total certification.

Last commit: `6ed682e734620ec6cc710ad59192350e3f46ed39` (audited core release tree, 2026-09-23; production 7d5b481 LIVE-OK; TEST-01).
