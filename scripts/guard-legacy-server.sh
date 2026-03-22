#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

echo "[guard] checking deploy/runtime entrypoints do not start legacy Flask..."
if rg -n "(python\\s+server/app\\.py|flask\\s+run|gunicorn\\s+.*server\\.app|uwsgi\\s+.*server\\.app)" \
  package.json start-dev.sh scripts/start-24x7.sh docker/dockerfile >/dev/null 2>&1; then
  echo "[guard] found legacy Flask start command in deployment/runtime entrypoints."
  exit 1
fi

echo "[guard] checking dist/ does not include legacy server files..."
if [[ -d dist ]] && find dist -type f | rg -n "(^|/)server/" >/dev/null 2>&1; then
  echo "[guard] dist/ unexpectedly contains legacy server artifacts."
  exit 1
fi

if [[ $# -gt 0 ]]; then
  for archive in "$@"; do
    if [[ ! -f "$archive" ]]; then
      echo "[guard] skip missing archive: $archive"
      continue
    fi
    echo "[guard] checking archive: $archive"
    if tar -tf "$archive" | rg -n "^server/" >/dev/null 2>&1; then
      echo "[guard] archive contains legacy server artifacts: $archive"
      exit 1
    fi
  done
else
  if [[ -f dist.tar.gz ]] && tar -tf dist.tar.gz | rg -n "^server/" >/dev/null 2>&1; then
    echo "[guard] dist.tar.gz contains legacy server artifacts."
    exit 1
  fi
fi

echo "[guard] legacy Flask exclusion checks passed."
