#!/bin/sh
set -eu
cd "$(dirname "$0")"
mkdir -p tiktoken-cache
image=${HONCHO_IMAGE:-ghcr.io/plastic-labs/honcho@sha256:6369a1a8387f560fd71296866a5e109420e3442ce2ea9ffdcf9f38529de416c1}
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
