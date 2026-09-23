#!/bin/sh
# Compatibility entry point restricted to personal development environments.
set -eu
host=${1:?usage: sh scripts/dev-deploy.sh saint-dev-<member>}
case "$host" in
  saint-dev-danil|saint-dev-ivan|saint-dev-artem) ;;
  *) echo 'Use your personal dev-server alias.' >&2; exit 1 ;;
esac
sh "$(dirname "$0")/deploy.sh" "$host"

# Honcho is optional and runs in a separate private Compose project on Ivan's
# dev host. Reattach the recreated backend after every deployment when present.
if [ "$host" = saint-dev-ivan ]; then
  ssh "$host" '
    if docker network inspect saint-honcho_honcho >/dev/null 2>&1; then
      if ! docker network inspect saint-honcho_honcho \
        --format "{{range .Containers}}{{.Name}} {{end}}" \
        | grep -qw saint_tibo-backend-1; then
        docker network connect saint-honcho_honcho saint_tibo-backend-1
      fi
    fi
  '
fi
