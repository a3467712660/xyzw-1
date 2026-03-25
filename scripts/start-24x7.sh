#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
APP_NAME_BACKEND="xyzw-backend"
APP_NAME_TASK_DAEMON="xyzw-task-daemon"
ENABLE_TASK_DAEMON="${ENABLE_TASK_DAEMON:-0}"

normalize_account_env_key() {
  local raw="$1"
  echo "$raw" | tr '[:lower:]' '[:upper:]' | sed 's/[^A-Z0-9]/_/g'
}

validate_task_daemon_env() {
  if [[ -n "${TASK_DAEMON_ACCOUNTS:-}" ]]; then
    local missing=0
    local account
    IFS=',' read -ra account_list <<< "${TASK_DAEMON_ACCOUNTS}"
    for account in "${account_list[@]}"; do
      account="$(echo "$account" | xargs)"
      [[ -z "$account" ]] && continue
      local env_key
      env_key="$(normalize_account_env_key "$account")"
      local user_var="TASK_DAEMON_${env_key}_USERNAME"
      local pass_var="TASK_DAEMON_${env_key}_PASSWORD"
      local username="${!user_var:-}"
      local password="${!pass_var:-}"
      if [[ -z "$username" || -z "$password" ]]; then
        echo "[error] 多账号模式下缺少 $user_var 或 $pass_var（账号: $account）"
        missing=1
      fi
    done
    if [[ "$missing" == "1" ]]; then
      exit 1
    fi
    return
  fi

  if [[ -z "${TASK_DAEMON_USERNAME:-}" || -z "${TASK_DAEMON_PASSWORD:-}" ]]; then
    echo "[error] 单账号模式下需提供 TASK_DAEMON_USERNAME 和 TASK_DAEMON_PASSWORD"
    exit 1
  fi
}

require_cmd() {
  local cmd="$1"
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "[error] Missing command: $cmd"
    exit 1
  fi
}

ensure_pm2() {
  if ! command -v pm2 >/dev/null 2>&1; then
    echo "[error] Missing command: pm2"
    echo "[hint] 生产机请预先安装并托管 pm2/systemd，不在启动脚本里临时全局安装。"
    exit 1
  fi
}

require_prebuilt_runtime() {
  if [[ ! -d "$ROOT_DIR/node_modules" ]]; then
    echo "[error] 缺少前端依赖目录: $ROOT_DIR/node_modules"
    echo "[hint] 请在构建机或制品准备阶段执行 npm ci，而不是在生产机临时安装。"
    exit 1
  fi

  if [[ ! -d "$ROOT_DIR/backend/node_modules" ]]; then
    echo "[error] 缺少后端依赖目录: $ROOT_DIR/backend/node_modules"
    echo "[hint] 请在构建机或制品准备阶段执行 npm --prefix backend ci。"
    exit 1
  fi

  if [[ ! -d "$ROOT_DIR/dist" ]]; then
    echo "[error] 缺少前端构建产物目录: $ROOT_DIR/dist"
    echo "[hint] 请先在构建机执行 npm run build，并由 Nginx/Caddy/静态文件服务托管 dist。"
    exit 1
  fi
}

stop_legacy_frontend_preview() {
  pm2 delete "xyzw-frontend" >/dev/null 2>&1 || true
}

start_all() {
  require_cmd npm
  ensure_pm2
  require_prebuilt_runtime

  cd "$ROOT_DIR"

  stop_legacy_frontend_preview

  echo "[start] Starting backend with PM2..."
  if pm2 describe "$APP_NAME_BACKEND" >/dev/null 2>&1; then
    pm2 restart "$APP_NAME_BACKEND" --update-env
  else
    pm2 start "npm run backend:start" \
      --name "$APP_NAME_BACKEND" \
      --cwd "$ROOT_DIR" \
      --time \
      --update-env
  fi

  echo "[info] 前端静态资源不再由 vite preview 托管。"
  echo "[info] 请使用 Nginx/Caddy/静态文件服务托管: $ROOT_DIR/dist"

  if [[ "$ENABLE_TASK_DAEMON" == "1" ]]; then
    validate_task_daemon_env
    echo "[start] Starting task daemon with PM2..."
    if pm2 describe "$APP_NAME_TASK_DAEMON" >/dev/null 2>&1; then
      pm2 restart "$APP_NAME_TASK_DAEMON" --update-env
    else
      pm2 start "npm run task:daemon" \
        --name "$APP_NAME_TASK_DAEMON" \
        --cwd "$ROOT_DIR" \
        --time \
        --update-env
    fi
  else
    pm2 delete "$APP_NAME_TASK_DAEMON" >/dev/null 2>&1 || true
  fi

  echo "[pm2] Saving process list..."
  pm2 save

  echo "[done] Services are up."
  echo "  Backend:  http://127.0.0.1:8787"
  echo "  Frontend: 由 Nginx/Caddy/静态文件服务托管 dist（非 PM2 / 非 vite preview）"
  if [[ "$ENABLE_TASK_DAEMON" == "1" ]]; then
    echo "  Daemon:   enabled (headless task-control runner)"
  else
    echo "  Daemon:   disabled (set ENABLE_TASK_DAEMON=1 to enable)"
  fi
  echo "  Check:    ./scripts/start-24x7.sh status"
  echo "  Logs:     ./scripts/start-24x7.sh logs"
}

stop_all() {
  ensure_pm2
  pm2 delete "$APP_NAME_TASK_DAEMON" >/dev/null 2>&1 || true
  stop_legacy_frontend_preview
  pm2 delete "$APP_NAME_BACKEND" >/dev/null 2>&1 || true
  pm2 save >/dev/null 2>&1 || true
  echo "[done] Services stopped."
}

restart_all() {
  ensure_pm2
  if pm2 describe "$APP_NAME_BACKEND" >/dev/null 2>&1; then
    pm2 restart "$APP_NAME_BACKEND" --update-env
  else
    echo "[info] $APP_NAME_BACKEND not found, starting..."
    start_all
    return
  fi

  stop_legacy_frontend_preview

  if [[ "$ENABLE_TASK_DAEMON" == "1" ]]; then
    validate_task_daemon_env
    if pm2 describe "$APP_NAME_TASK_DAEMON" >/dev/null 2>&1; then
      pm2 restart "$APP_NAME_TASK_DAEMON" --update-env
    else
      pm2 start "npm run task:daemon" \
        --name "$APP_NAME_TASK_DAEMON" \
        --cwd "$ROOT_DIR" \
        --time \
        --update-env
    fi
  else
    pm2 delete "$APP_NAME_TASK_DAEMON" >/dev/null 2>&1 || true
  fi

  echo "[done] Services restarted."
}

status_all() {
  ensure_pm2
  pm2 list
}

logs_all() {
  ensure_pm2
  pm2 logs "$APP_NAME_BACKEND" "$APP_NAME_TASK_DAEMON"
}

enable_boot() {
  ensure_pm2
  pm2 save
  pm2 startup
}

usage() {
  cat <<USAGE
Usage: ./scripts/start-24x7.sh <command>

Commands:
  start      Start backend/task-daemon with PM2 using prebuilt artifacts
  stop       Stop and remove PM2 processes
  restart    Restart PM2 processes
  status     Show PM2 process status
  logs       Tail PM2 logs (backend + daemon)
  enable-boot  Configure PM2 startup on system boot

Env:
  ENABLE_TASK_DAEMON=1 Enable headless task-control runner
  NODE_ENV=production  Recommended default for this script
  TASK_DAEMON_USERNAME=xxx Single-account username
  TASK_DAEMON_PASSWORD=xxx Single-account password
  TASK_DAEMON_ACCOUNTS=acc1,acc2 Multi-account IDs (optional)
  TASK_DAEMON_<ID>_USERNAME=xxx Multi-account username (ID uppercased, non-alnum to _)
  TASK_DAEMON_<ID>_PASSWORD=xxx Multi-account password (ID uppercased, non-alnum to _)
  TASK_DAEMON_BASE_URL=http://127.0.0.1:3000 Base URL for daemon
  TASK_DAEMON_PERSIST_SESSION=false Persist browser session to disk (default: false)
  TASK_DAEMON_USER_DATA_DIR=.runtime/task-daemon-profile User data dir when persistence is enabled
  TASK_DAEMON_DISABLE_SANDBOX=false Allow --no-sandbox only in non-prod localhost mode

Notes:
  - 本脚本不负责 npm install / npm ci / npm run build。
  - 本脚本不负责前端静态托管，也不会启动 vite preview。
  - 生产机应只接收已构建好的 dist 和已准备好的 backend 运行时。
USAGE
}

main() {
  local cmd="${1:-}"

  case "$cmd" in
    start)
      start_all
      ;;
    stop)
      stop_all
      ;;
    restart)
      restart_all
      ;;
    status)
      status_all
      ;;
    logs)
      logs_all
      ;;
    enable-boot)
      enable_boot
      ;;
    *)
      usage
      exit 1
      ;;
  esac
}

main "$@"
