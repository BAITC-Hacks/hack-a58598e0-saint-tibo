#!/bin/sh
set -eu
cd "$(dirname "$0")"
mkdir -p tiktoken-cache
image=${HONCHO_IMAGE:-ghcr.io/plastic-labs/honcho:v3.2.0}
# Fetch public tokenizer data once; runtime services consume it from a
# read-only cache while running on an egress-isolated network.
docker run --rm \
  --volume "$PWD/tiktoken-cache:/var/cache/tiktoken" \
  --env TIKTOKEN_CACHE_DIR=/var/cache/tiktoken \
  --entrypoint /app/.venv/bin/python \
  "$image" -c 'import tiktoken; tiktoken.get_encoding("o200k_base"); tiktoken.get_encoding("cl100k_base")'
find tiktoken-cache -type f -size +0c | grep -q . || {
  echo "tokenizer cache was not populated" >&2
  exit 1
}
echo "Tokenizer cache ready; no meeting data was used."
