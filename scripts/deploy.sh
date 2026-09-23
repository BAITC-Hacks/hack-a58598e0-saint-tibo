#!/bin/sh
# Manual deployment of the current committed tree. Nothing runs on push.
set -eu

host=${1:?usage: sh scripts/deploy.sh <saint-dev-danil|saint-dev-ivan|saint-dev-artem|saint-prod>}
case "$host" in
  saint-dev-danil) domain=dev-danil.saint-tibo.win; dev_login=true ;;
  saint-dev-ivan) domain=dev-ivan.saint-tibo.win; dev_login=true ;;
  saint-dev-artem) domain=dev-artem.saint-tibo.win; dev_login=true ;;
  saint-prod) domain=saint-tibo.win; dev_login=false ;;
  *) echo "Unknown environment" >&2; exit 1 ;;
esac
cd "$(git rev-parse --show-toplevel)"
if [ -n "$(git status --porcelain)" ]; then
  echo "Commit or save working changes before deploying a revision." >&2
  exit 1
fi
revision=$(git rev-parse HEAD)
if [ "$host" = saint-prod ]; then
  git fetch origin main
  if [ "$(git branch --show-current)" != main ] || [ "$revision" != "$(git rev-parse origin/main)" ]; then
    echo "Production requires the current origin/main checked out on main." >&2
    exit 1
  fi
fi
release="/opt/saint-tibo/releases/$revision"

ssh "$host" 'docker compose version >/dev/null && command -v python3 >/dev/null'
# Personal servers may contain a colleague's release not yet merged into dev.
# Refuse to replace it unless this candidate retains that commit's history.
deployed_revision=$(ssh "$host" sh -s <<'STATE'
set -eu
if [ -L /opt/saint-tibo/current ]; then
  deployed=$(readlink /opt/saint-tibo/current)
  printf '%s\n' "${deployed##*/}"
elif [ -e /opt/saint-tibo/current ]; then
  echo '/opt/saint-tibo/current must be a symlink.' >&2
  exit 1
fi
STATE
)
if [ -n "$deployed_revision" ]; then
  case "$deployed_revision" in
    *[!0-9a-f]*) echo 'Invalid deployed revision; inspect the server.' >&2; exit 1 ;;
  esac
  if [ "${#deployed_revision}" -ne 40 ] ||
     ! git cat-file -e "$deployed_revision^{commit}" 2>/dev/null ||
     ! git merge-base --is-ancestor "$deployed_revision" "$revision"; then
    printf 'Deployment refused: include deployed commit %s before replacing this environment.\n' "$deployed_revision" >&2
    exit 1
  fi
fi
# Only tracked source is transferred. No GitHub credentials or workstation .env.
git archive "$revision" | ssh "$host" "umask 077; mkdir -p '$release'; tar -xf - -C '$release'"
MSYS_NO_PATHCONV=1 ssh "$host" sh -s -- "$release" "$revision" "$domain" "$dev_login" "$deployed_revision" <<'REMOTE'
set -eu
release=$1
revision=$2
domain=$3
dev_login=$4
expected_revision=$5
actual_release=$(readlink /opt/saint-tibo/current || true)
if [ "${actual_release##*/}" != "$expected_revision" ]; then
  echo 'The active release changed during preparation; inspect and retry.' >&2
  exit 1
fi
# Process environment overrides dotenv interpolation, including on production.
export DEV_LOGIN_ENABLED="$dev_login"
export MOCK_API_ENABLED="$dev_login"
cd "$release"
python3 - "$domain" "$dev_login" <<'PY'
import os
import secrets
import sys
from pathlib import Path

environment = Path('/opt/saint-tibo/.env')
domain = sys.argv[1]
dev_login = sys.argv[2]
dev_domains = {'dev-danil.saint-tibo.win', 'dev-ivan.saint-tibo.win', 'dev-artem.saint-tibo.win'}
if dev_login not in {'true', 'false'} or (dev_login == 'true' and domain not in dev_domains):
    raise SystemExit('Dev login is not allowed for this deployment domain.')
if not environment.exists():
    content = Path('.env.example').read_text()
    content = content.replace('BETTER_AUTH_SECRET=', 'BETTER_AUTH_SECRET=' + secrets.token_hex(32))
    content = content.replace('POSTGRES_PASSWORD=saint_tibo', 'POSTGRES_PASSWORD=' + secrets.token_hex(24))
    with os.fdopen(os.open(environment, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600), 'w') as output:
        output.write(content)
content = environment.read_text()
values = dict(line.split('=', 1) for line in content.splitlines() if '=' in line and not line.startswith('#'))
updates = {'DEV_LOGIN_ENABLED': dev_login, 'MOCK_API_ENABLED': dev_login}
if values.get('APP_DOMAIN', 'localhost') == 'localhost':
    origin = 'https://' + domain
    updates.update({
        'APP_DOMAIN': domain,
        'BETTER_AUTH_URL': origin,
        'BACKEND_AUTH_ISSUER': origin,
        'BACKEND_CORS_ORIGINS': '["' + origin + '"]',
        'VITE_API_URL': origin,
    })
elif values['APP_DOMAIN'] != domain:
    raise SystemExit('Server domain differs; inspect its environment before deploying.')
# Remove duplicate assignments of managed keys before appending their canonical values.
# Preserve all other values and never regenerate existing database/auth secrets.
lines = [line for line in content.splitlines() if line.split('=', 1)[0].strip() not in updates]
lines.extend(key + '=' + value for key, value in updates.items())
updated = '\n'.join(lines) + '\n'
if updated != content:
    environment.write_text(updated)
environment.chmod(0o600)
local = Path('.env')
if not local.exists():
    local.symlink_to(environment)
PY
# Persist the explicit GPU opt-in across normal deployments without sourcing
# secret-bearing dotenv values as shell code.
remote_stt=$(python3 - <<'PY'
from pathlib import Path
values = dict(
    line.split('=', 1)
    for line in Path('/opt/saint-tibo/.env').read_text().splitlines()
    if '=' in line and not line.startswith('#')
)
enabled = values.get('STT_REMOTE_ENABLED', 'false').strip().lower()
if enabled not in {'true', 'false'}:
    raise SystemExit('STT_REMOTE_ENABLED must be true or false.')
print(enabled)
PY
)
if [ "$remote_stt" = true ]; then
  export COMPOSE_FILE=compose.yaml:tools/transcribe/compose.remote.yaml
fi
profiles="--profile app --profile edge"
if [ "$dev_login" = true ]; then profiles="$profiles --profile mock"; fi
docker compose $profiles config --quiet
docker compose $profiles run --rm --no-deps gateway caddy validate --config /etc/caddy/Caddyfile
docker compose $profiles up -d --build --wait --wait-timeout 180
if [ "$dev_login" = true ]; then
  docker compose --profile app --profile edge --profile dev-tools run --rm --build --no-deps auth-seed-dev
fi
api=$(docker compose port backend 8000)
web=$(docker compose port frontend 3000)
curl --fail --silent "http://$api/health/ready"
curl --fail --silent --output /dev/null "http://$web/login"
curl --fail --silent --show-error --retry 12 --retry-all-errors --retry-delay 2 --max-time 10 "https://$domain/health/ready"
curl --fail --silent --output /dev/null "https://$domain/login"
docker compose ps
if [ -e /opt/saint-tibo/current ] && [ ! -L /opt/saint-tibo/current ]; then
  echo '/opt/saint-tibo/current must be a symlink; refusing to replace it.' >&2
  exit 1
fi
ln -sfn "$release" /opt/saint-tibo/current
printf '\nRunning revision: %s\n' "$revision"
printf 'URL: https://%s\n' "$domain"
REMOTE
