#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SOURCE_NGINX_CONF="$ROOT_DIR/deploy/nginx/xyzw-xq5007.conf"
TARGET_NGINX_CONF="/opt/homebrew/etc/nginx/servers/xyzw-xq5007.conf"
NGINX_BIN="/opt/homebrew/bin/nginx"
NGINX_PID_FILE="/opt/homebrew/var/run/nginx.pid"
DIST_ROOT="$ROOT_DIR/dist"

require_file() {
  local file="$1"
  if [[ ! -f "$file" ]]; then
    echo "[error] Missing file: $file"
    exit 1
  fi
}

ensure_nginx_installed() {
  if [[ ! -x "$NGINX_BIN" ]]; then
    echo "[error] nginx not found: $NGINX_BIN"
    echo "[hint] 请先通过 Homebrew 安装 nginx。"
    exit 1
  fi
}

resolve_build_metadata() {
  local git_sha=""
  if command -v git >/dev/null 2>&1; then
    git_sha="$(git -C "$ROOT_DIR" rev-parse HEAD 2>/dev/null || true)"
  fi

  export NODE_ENV="${NODE_ENV:-production}"
  export BUILD_GIT_SHA="${BUILD_GIT_SHA:-$git_sha}"
  export BUILD_ID="${BUILD_ID:-deploy-$(date '+%Y%m%d%H%M%S')}"
  export BUILD_TIME="${BUILD_TIME:-$(date -u '+%Y-%m-%dT%H:%M:%SZ')}"

  if [[ -z "$BUILD_GIT_SHA" ]]; then
    echo "[error] 无法解析 BUILD_GIT_SHA，请确认当前目录是 git 仓库，或手工导出 BUILD_GIT_SHA。"
    exit 1
  fi

  echo "[build] BUILD_GIT_SHA=$BUILD_GIT_SHA"
  echo "[build] BUILD_ID=$BUILD_ID"
  echo "[build] BUILD_TIME=$BUILD_TIME"
}

ensure_nginx_conf_dir() {
  local conf_dir
  conf_dir="$(dirname "$TARGET_NGINX_CONF")"
  if [[ ! -d "$conf_dir" ]]; then
    echo "[error] nginx 站点目录不存在: $conf_dir"
    exit 1
  fi
}

build_frontend() {
  echo "[build] 开始构建前端 dist..."
  (
    cd "$ROOT_DIR"
    npm run build
  )
  echo "[ok] 前端 dist 构建完成"
}

sync_nginx_conf() {
  require_file "$SOURCE_NGINX_CONF"
  ensure_nginx_conf_dir
  require_file "$DIST_ROOT/index.html"

  local rendered_conf
  rendered_conf="$(mktemp)"
  sed "s|__APP_DIST_ROOT__|$DIST_ROOT|g" "$SOURCE_NGINX_CONF" > "$rendered_conf"

  if [[ ! -f "$TARGET_NGINX_CONF" ]] || ! cmp -s "$rendered_conf" "$TARGET_NGINX_CONF"; then
    cp "$rendered_conf" "$TARGET_NGINX_CONF"
    echo "[ok] 已同步 nginx 配置到: $TARGET_NGINX_CONF"
  else
    echo "[skip] nginx 配置无变化"
  fi

  rm -f "$rendered_conf"
}

nginx_test() {
  "$NGINX_BIN" -t
}

nginx_running() {
  local pid=""
  if [[ -f "$NGINX_PID_FILE" ]]; then
    pid="$(tr -d '[:space:]' < "$NGINX_PID_FILE" 2>/dev/null || true)"
  fi

  if [[ -n "$pid" ]] && ps -p "$pid" >/dev/null 2>&1; then
    return 0
  fi

  return 1
}

start_or_reload_nginx() {
  if nginx_running; then
    "$NGINX_BIN" -s reload
    echo "[ok] nginx 已重载"
  else
    "$NGINX_BIN"
    echo "[ok] nginx 已启动"
  fi
}

start_backend() {
  (
    cd "$ROOT_DIR"
    NODE_ENV=production ./scripts/start-24x7.sh start
  )
}

status_all() {
  echo "[status] nginx"
  if nginx_running; then
    echo "  running"
  else
    echo "  stopped"
  fi

  echo "[status] backend"
  (
    cd "$ROOT_DIR"
    ./scripts/start-24x7.sh status || true
  )
}

usage() {
  cat <<USAGE
Usage: ./scripts/start-xq5007.sh <command>

Commands:
  start     构建前端、同步 nginx 配置、校验配置、启动后端、启动/重载 nginx
  reload    仅同步 nginx 配置并重载 nginx
  status    查看 nginx 和 backend 状态

Notes:
  - 运行前请确认 backend/.env 已正确配置 production 所需变量。
  - start 会自动执行 npm run build 生成最新 dist。
  - 内网穿透请只暴露本机 3000 端口，不要直接暴露 8787。
USAGE
}

main() {
  ensure_nginx_installed
  resolve_build_metadata

  case "${1:-}" in
    start)
      build_frontend
      sync_nginx_conf
      nginx_test
      start_backend
      start_or_reload_nginx
      ;;
    reload)
      sync_nginx_conf
      nginx_test
      start_or_reload_nginx
      ;;
    status)
      status_all
      ;;
    *)
      usage
      exit 1
      ;;
  esac
}

main "$@"
