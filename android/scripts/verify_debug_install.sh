#!/usr/bin/env bash
set -euo pipefail

ANDROID_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APK_PATH="${APK_PATH:-$ANDROID_DIR/app/build/outputs/apk/debug/app-debug.apk}"
ADB_BIN="${ADB_BIN:-adb}"
PACKAGE_NAME="${PACKAGE_NAME:-com.xyzw.helper.debug}"
ACTIVITY_NAME="${ACTIVITY_NAME:-com.xyzw.helper/com.xyzw.helper.MainActivity}"
BOOT_WAIT_SECONDS="${BOOT_WAIT_SECONDS:-8}"
LOG_PATTERN="${LOG_PATTERN:-auth/csrf|auth/login|X-CSRF-Token|auth/refresh|/ws|connected|reauthenticated}"
SKIP_BUILD="${SKIP_BUILD:-0}"

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

adb_cmd() {
  if [[ -n "${ADB_SERIAL:-}" ]]; then
    "$ADB_BIN" -s "$ADB_SERIAL" "$@"
  else
    "$ADB_BIN" "$@"
  fi
}

ensure_device() {
  local devices
  devices="$(adb_cmd devices | awk 'NR>1 && $2=="device" {print $1}')"
  if [[ -z "$devices" ]]; then
    echo "No online adb device found. Connect a device or start an emulator first." >&2
    exit 1
  fi
}

build_apk() {
  if [[ "$SKIP_BUILD" == "1" ]]; then
    return
  fi
  (
    cd "$ANDROID_DIR"
    ./gradlew assembleDebug
  )
}

install_and_launch() {
  adb_cmd logcat -c
  adb_cmd install -r "$APK_PATH"
  adb_cmd shell am force-stop "$PACKAGE_NAME" || true
  adb_cmd shell am start -W -n "$ACTIVITY_NAME"
  sleep "$BOOT_WAIT_SECONDS"
}

verify_process_started() {
  local pid
  pid="$(adb_cmd shell pidof -s "$PACKAGE_NAME" 2>/dev/null | tr -d '\r')"
  if [[ -z "$pid" ]]; then
    echo "App process did not start: $PACKAGE_NAME" >&2
    exit 1
  fi
  echo "App started successfully with pid: $pid"
  echo "$pid"
}

print_log_snapshot() {
  local pid="$1"
  echo
  echo "Recent app logcat lines matching: $LOG_PATTERN"
  if ! adb_cmd logcat --pid "$pid" -d 2>/dev/null | grep -E "$LOG_PATTERN"; then
    echo "(no matching lines captured yet)"
  fi
}

print_manual_checks() {
  local pid="$1"
  echo
  echo "Manual follow-up validation:"
  echo "1. Keep this tail running while operating the app:"
  if [[ -n "${ADB_SERIAL:-}" ]]; then
    echo "   $ADB_BIN -s $ADB_SERIAL logcat --pid $pid | grep -E \"$LOG_PATTERN\""
  else
    echo "   $ADB_BIN logcat --pid $pid | grep -E \"$LOG_PATTERN\""
  fi
  echo "2. Launch login flow and confirm startup/login traffic includes /api/v1/auth/csrf and /api/v1/auth/login."
  echo "3. Confirm login POST carries X-CSRF-Token."
  echo "4. Revoke/expire session once and confirm only one /api/v1/auth/refresh retry occurs."
  echo "5. Exercise realtime features and confirm /ws handshake succeeds with cookie-auth, plus connected/reauthenticated events."
}

main() {
  require_command "$ADB_BIN"
  ensure_device
  build_apk

  if [[ ! -f "$APK_PATH" ]]; then
    echo "APK not found: $APK_PATH" >&2
    exit 1
  fi

  install_and_launch
  local pid
  pid="$(verify_process_started)"
  print_log_snapshot "$pid"
  print_manual_checks "$pid"
}

main "$@"
