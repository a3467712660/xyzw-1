#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_PID=""
BACKEND_ENV_FILE="${ROOT_DIR}/backend/.env"
BACKEND_PORT="${BACKEND_PORT:-8787}"
BACKEND_HEALTH_URL="http://127.0.0.1:${BACKEND_PORT}/health"
HEALTH_RETRY_COUNT=20
HEALTH_RETRY_INTERVAL_SEC=0.5
NODE_REQUIRE_CHECK_SCRIPT='
const { createRequire } = require("module");
const baseDir = process.argv[1];
const request = createRequire(`${baseDir}/package.json`);
for (const pkg of process.argv.slice(2)) {
  request.resolve(pkg);
}
'

cleanup() {
  if [[ -n "${BACKEND_PID}" ]] && kill -0 "${BACKEND_PID}" 2>/dev/null; then
    echo ""
    echo "[cleanup] Stopping backend (PID: ${BACKEND_PID})..."
    kill "${BACKEND_PID}" 2>/dev/null || true
    wait "${BACKEND_PID}" 2>/dev/null || true
  fi
}

trap cleanup EXIT INT TERM

cd "${ROOT_DIR}"

if [[ ! -f "${BACKEND_ENV_FILE}" ]]; then
  echo "[error] Missing backend/.env"
  echo "[hint] Create it with: cp backend/.env.example backend/.env"
  exit 1
fi

check_dependency_health() {
  local base_dir="$1"
  shift
  node -e "${NODE_REQUIRE_CHECK_SCRIPT}" "${base_dir}" "$@" >/dev/null 2>&1
}

ensure_frontend_dependencies() {
  if [[ ! -d node_modules ]]; then
    echo "[setup] Frontend dependencies missing, running npm ci..."
    npm ci
    return
  fi

  if ! check_dependency_health "${ROOT_DIR}" \
    "vite/package.json" \
    "jiti/package.json" \
    "@eslint/plugin-kit/package.json"
  then
    echo "[setup] Frontend dependencies incomplete or corrupted, running npm ci..."
    npm ci
  fi
}

ensure_backend_dependencies() {
  if [[ ! -d backend/node_modules ]]; then
    echo "[setup] Backend dependencies missing, running npm --prefix backend ci..."
    npm --prefix backend ci
    return
  fi

  if ! check_dependency_health "${ROOT_DIR}/backend" \
    "express/package.json" \
    "better-sqlite3/package.json"
  then
    echo "[setup] Backend dependencies incomplete or corrupted, running npm --prefix backend ci..."
    npm --prefix backend ci
  fi
}

ensure_frontend_dependencies
ensure_backend_dependencies

wait_backend_healthy() {
  local attempt=1
  while [[ "${attempt}" -le "${HEALTH_RETRY_COUNT}" ]]; do
    if curl -fsS "${BACKEND_HEALTH_URL}" >/dev/null 2>&1; then
      return 0
    fi
    sleep "${HEALTH_RETRY_INTERVAL_SEC}"
    attempt=$((attempt + 1))
  done
  return 1
}

echo "[start] Starting backend..."
npm run backend:dev &
BACKEND_PID=$!
sleep 1

if ! kill -0 "${BACKEND_PID}" 2>/dev/null; then
  echo "[error] Backend failed to start."
  exit 1
fi

if ! wait_backend_healthy; then
  echo "[error] Backend process exists but health check failed: ${BACKEND_HEALTH_URL}"
  echo "[hint] This usually means port conflict or backend crash loop."
  echo "[hint] Check who is using port ${BACKEND_PORT}: lsof -i :${BACKEND_PORT}"
  exit 1
fi

echo "[start] Starting frontend..."
npm run dev
