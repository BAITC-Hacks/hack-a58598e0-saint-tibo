#!/bin/sh
# Manual deployment of the current committed tree. Nothing runs on push.
set -eu

host=${1:?usage: sh scripts/deploy.sh <saint-dev-danil|saint-dev-ivan|saint-dev-artem|saint-prod>}
case "$host" in
  saint-dev-danil) domain=dev-danil.saint-tibo.win ;;
  saint-dev-ivan) domain=dev-ivan.saint-tibo.win ;;
  saint-dev-artem) domain=dev-artem.saint-tibo.win ;;
  saint-prod) domain=saint-tibo.win ;;
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
# Only tracked source is transferred. No GitHub credentials or workstation .env.
git archive "$revision" | ssh "$host" "umask 077; mkdir -p '$release'; tar -xf - -C '$release'"
ssh "$host" sh -s -- "$release" "$revision" "$domain" <<'REMOTE'
set -eu
release=$1
revision=$2
domain=$3
cd "$release"
python3 - "$domain" <<'PY'
import os
import secrets
import sys
from pathlib import Path

environment = Path('/opt/saint-tibo/.env')
domain = sys.argv[1]
if not environment.exists():
    content = Path('.env.example').read_text()
    content = content.replace('BETTER_AUTH_SECRET=', 'BETTER_AUTH_SECRET=' + secrets.token_hex(32))
    content = content.replace('POSTGRES_PASSWORD=saint_tibo', 'POSTGRES_PASSWORD=' + secrets.token_hex(24))
    with os.fdopen(os.open(environment, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600), 'w') as output:
        output.write(content)
content = environment.read_text()
values = dict(line.split('=', 1) for line in content.splitlines() if '=' in line and not line.startswith('#'))
if values.get('APP_DOMAIN', 'localhost') == 'localhost':
    origin = 'https://' + domain
    updates = {
        'APP_DOMAIN': domain,
        'BETTER_AUTH_URL': origin,
        'BACKEND_AUTH_ISSUER': origin,
        'BACKEND_CORS_ORIGINS': '["' + origin + '"]',
        'VITE_API_URL': origin,
    }
    lines = []
    for line in content.splitlines():
        key = line.split('=', 1)[0]
        lines.append(key + '=' + updates.pop(key) if key in updates else line)
    lines.extend(key + '=' + value for key, value in updates.items())
    environment.write_text('\n'.join(lines) + '\n')
    environment.chmod(0o600)
elif values['APP_DOMAIN'] != domain:
    raise SystemExit('Server domain differs; inspect its environment before deploying.')
local = Path('.env')
if not local.exists():
    local.symlink_to(environment)
PY
docker compose --profile app --profile edge config --quiet
docker compose --profile app --profile edge run --rm --no-deps gateway caddy validate --config /etc/caddy/Caddyfile
docker compose --profile app --profile edge up -d --build --wait --wait-timeout 180
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
