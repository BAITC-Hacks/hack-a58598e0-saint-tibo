#!/bin/sh
# Manual deployment of the current committed tree to a personal development server.
set -eu

host=${1:?usage: sh scripts/dev-deploy.sh saint-dev-<member>}
case "$host" in
  -*|*[!a-zA-Z0-9_.@-]*) echo "Invalid SSH host" >&2; exit 1 ;;
esac
cd "$(git rev-parse --show-toplevel)"
if [ -n "$(git status --porcelain)" ]; then
  echo "Commit or save working changes before deploying a revision." >&2
  exit 1
fi
revision=$(git rev-parse HEAD)
release="/opt/saint-tibo/releases/$revision"

ssh "$host" 'docker compose version >/dev/null && command -v python3 >/dev/null'
# Only tracked source is transferred. No GitHub credentials or workstation .env.
git archive "$revision" | ssh "$host" "umask 077; mkdir -p '$release'; tar -xf - -C '$release'"
ssh "$host" sh -s -- "$release" "$revision" <<'REMOTE'
set -eu
release=$1
revision=$2
cd "$release"
python3 - <<'PY'
import os
import secrets
from pathlib import Path

environment = Path('/opt/saint-tibo/.env')
if not environment.exists():
    content = Path('.env.example').read_text()
    content = content.replace('BETTER_AUTH_SECRET=', 'BETTER_AUTH_SECRET=' + secrets.token_hex(32))
    content = content.replace('POSTGRES_PASSWORD=saint_tibo', 'POSTGRES_PASSWORD=' + secrets.token_hex(24))
    with os.fdopen(os.open(environment, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600), 'w') as output:
        output.write(content)
local = Path('.env')
if not local.exists():
    local.symlink_to(environment)
PY
docker compose --profile app up -d --build --wait --wait-timeout 180
api=$(docker compose port backend 8000)
web=$(docker compose port frontend 3000)
curl --fail --silent "http://$api/health/ready"
curl --fail --silent --output /dev/null "http://$web/login"
docker compose ps
if [ -e /opt/saint-tibo/current ] && [ ! -L /opt/saint-tibo/current ]; then
  echo '/opt/saint-tibo/current must be a symlink; refusing to replace it.' >&2
  exit 1
fi
ln -sfn "$release" /opt/saint-tibo/current
printf '\nRunning revision: %s\n' "$revision"
REMOTE
