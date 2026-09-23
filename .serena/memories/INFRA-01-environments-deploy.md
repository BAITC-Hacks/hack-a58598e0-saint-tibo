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
- Exact `97e804e` has DEPLOY-OK plus independent [review/export LIVE-OK](https://github.com/BAITC-Hacks/hack-a58598e0-saint-tibo/issues/14#issuecomment-5793710152)
  on Danil dev, including migration 0005 and real JWT downloads/ACL.
- Dev `34062c4` adds synthetic player; `ab3d331` adds marker overflow fix.
  Those frontend changes still need scheduled dev deploy/browser proof.
  The user authorized current-wave main/prod release after QA without #69;
  fetched main remains 62b137d. Parent records exact release receipts in #94.
- Organizational controls, retention/backup proof and enterprise hardening
  remain separate issues; local model egress isolation is not total certification.

Last commit: `ab3d3312c3bafb3892bde93539383cea9e48b6de` (audited tree, 2026-09-23; live evidence is separate).
