#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

# Legacy Flask is high risk and for temporary internal troubleshooting only.
export ENABLE_LEGACY_FLASK="${ENABLE_LEGACY_FLASK:-1}"
export FLASK_RUN_HOST="${FLASK_RUN_HOST:-127.0.0.1}"
export FLASK_RUN_PORT="${FLASK_RUN_PORT:-5000}"

# Safer defaults: strict cookie policy, upload size cap and outbound timeout.
export SESSION_COOKIE_SAMESITE="${SESSION_COOKIE_SAMESITE:-Strict}"
export SESSION_COOKIE_HTTPONLY="${SESSION_COOKIE_HTTPONLY:-true}"
export SESSION_COOKIE_SECURE="${SESSION_COOKIE_SECURE:-false}"
export LEGACY_MAX_CONTENT_LENGTH="${LEGACY_MAX_CONTENT_LENGTH:-2097152}"
export LEGACY_HTTP_TIMEOUT_SECONDS="${LEGACY_HTTP_TIMEOUT_SECONDS:-8}"

echo "[legacy-safe-start] starting legacy Flask on ${FLASK_RUN_HOST}:${FLASK_RUN_PORT}"
echo "[legacy-safe-start] MAX_CONTENT_LENGTH=${LEGACY_MAX_CONTENT_LENGTH}, HTTP_TIMEOUT=${LEGACY_HTTP_TIMEOUT_SECONDS}s, SAMESITE=${SESSION_COOKIE_SAMESITE}, SECURE=${SESSION_COOKIE_SECURE}"

python app.py
