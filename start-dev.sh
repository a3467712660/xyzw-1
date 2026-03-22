#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_PID=""
BACKEND_ENV_FILE="${ROOT_DIR}/backend/.env"
BACKEND_PORT="${BACKEND_PORT:-8787}"
BACKEND_HEALTH_URL="http://127.0.0.1:${BACKEND_PORT}/health"
HEALTH_RETRY_COUNT=20
HEALTH_RETRY_INTERVAL_SEC=0.5

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

if [[ ! -d node_modules ]]; then
  echo "[setup] Installing frontend dependencies..."
  npm install
fi

if [[ ! -d backend/node_modules ]]; then
  echo "[setup] Installing backend dependencies..."
  npm --prefix backend install
fi

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
