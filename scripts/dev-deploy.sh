#!/bin/sh
# Compatibility entry point restricted to personal development environments.
set -eu
host=${1:?usage: sh scripts/dev-deploy.sh saint-dev-<member>}
case "$host" in
  saint-dev-danil|saint-dev-ivan|saint-dev-artem) ;;
  *) echo 'Use your personal dev-server alias.' >&2; exit 1 ;;
esac
exec sh "$(dirname "$0")/deploy.sh" "$host"
