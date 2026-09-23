#!/bin/sh
set -eu
cd "$(dirname "$0")"

if [ -z "${HONCHO_URL:-}" ]; then
  port=${HONCHO_PORT:-18000}
  if curl --silent --fail --max-time 2 "http://127.0.0.1:$port/health" >/dev/null; then
    HONCHO_URL="http://127.0.0.1:$port"
  else
    container=$(docker compose --env-file .env -f compose.yaml ps -q api)
    [ -n "$container" ] || { echo "Honcho API container is not running" >&2; exit 1; }
    address=$(docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' "$container")
    HONCHO_URL="http://$address:8000"
  fi
  export HONCHO_URL
fi

if [ -z "${HONCHO_JWT_SECRET:-}" ]; then
  HONCHO_JWT_SECRET=$(sed -n 's/^HONCHO_JWT_SECRET=//p' .env)
  export HONCHO_JWT_SECRET
fi

mise exec -- python smoke.py
