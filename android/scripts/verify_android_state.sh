#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ANDROID_DIR="$REPO_ROOT/android"

KEY_FILES=(
  "android/settings.gradle.kts"
  "android/build.gradle.kts"
  "android/app/build.gradle.kts"
  "android/gradle/libs.versions.toml"
  "android/gradle/wrapper/gradle-wrapper.properties"
  "android/app/src/main/AndroidManifest.xml"
  "android/app/src/debug/AndroidManifest.xml"
  "android/app/src/release/AndroidManifest.xml"
  "android/app/src/debug/res/xml/debug_network_security_config.xml"
  "android/app/src/main/res/values/strings.xml"
  "android/app/src/main/res/values/styles.xml"
  "android/app/src/main/java/com/xyzw/helper/MainActivity.kt"
  "android/app/src/main/java/com/xyzw/helper/app/XyzwHelperApplication.kt"
  "android/app/src/main/java/com/xyzw/helper/data/network/CsrfInterceptor.kt"
  "android/app/src/test/java/com/xyzw/helper/data/network/CsrfInterceptorTest.kt"
)

print_header() {
  echo
  echo "== $1 =="
}

print_repo_identity() {
  print_header "Repo Identity"
  (
    cd "$REPO_ROOT"
    echo "branch: $(git branch --show-current)"
    echo "commit: $(git rev-parse HEAD)"
  )
}

print_key_file_snapshot() {
  print_header "Key File Snapshot"
  (
    cd "$REPO_ROOT"
    python3 - <<'PY'
from pathlib import Path
import hashlib

files = [
  "android/settings.gradle.kts",
  "android/build.gradle.kts",
  "android/app/build.gradle.kts",
  "android/gradle/libs.versions.toml",
  "android/gradle/wrapper/gradle-wrapper.properties",
  "android/app/src/main/AndroidManifest.xml",
  "android/app/src/debug/AndroidManifest.xml",
  "android/app/src/release/AndroidManifest.xml",
  "android/app/src/debug/res/xml/debug_network_security_config.xml",
  "android/app/src/main/res/values/strings.xml",
  "android/app/src/main/res/values/styles.xml",
  "android/app/src/main/java/com/xyzw/helper/MainActivity.kt",
  "android/app/src/main/java/com/xyzw/helper/app/XyzwHelperApplication.kt",
  "android/app/src/main/java/com/xyzw/helper/data/network/CsrfInterceptor.kt",
  "android/app/src/test/java/com/xyzw/helper/data/network/CsrfInterceptorTest.kt",
]

for rel in files:
    path = Path(rel)
    print(f"--- {rel}")
    if not path.exists():
      print("exists=false")
      continue
    text = path.read_text(errors="ignore")
    lines = text.count("\n") + (0 if text.endswith("\n") or text == "" else 1)
    sha = hashlib.sha256(path.read_bytes()).hexdigest()
    print(f"exists=true lines={lines} sha256={sha}")
    preview = "\n".join(text.splitlines()[:12])
    print(preview)
PY
  )
}

validate_tracked_files() {
  print_header "Tracked File Validation"
  (
    cd "$REPO_ROOT"
    python3 - <<'PY'
from pathlib import Path
import subprocess
import tomllib

root = Path("android")
tracked = []
for path in root.rglob("*"):
    if not path.is_file():
        continue
    posix = path.as_posix()
    if "/build/" in posix or "/.gradle/" in posix or posix.endswith("/local.properties"):
        continue
    if path.suffix.lower() in {".kt", ".kts", ".toml", ".properties", ".xml", ".md"}:
        tracked.append(path)

short_files = []
xml_files = []
toml_files = []
properties_files = []

for path in tracked:
    text = path.read_text(errors="ignore")
    lines = text.count("\n") + (0 if text.endswith("\n") or text == "" else 1)
    if lines <= 3:
        short_files.append((lines, path.as_posix()))
    if path.suffix.lower() == ".xml":
        xml_files.append(path)
    elif path.suffix.lower() == ".toml":
        toml_files.append(path)
    elif path.suffix.lower() == ".properties":
        properties_files.append(path)

print(f"tracked_files={len(tracked)}")
print(f"short_files={len(short_files)}")
for lines, path in short_files:
    print(f"short_file lines={lines} path={path}")

for path in xml_files:
    subprocess.run(["xmllint", "--noout", str(path)], check=True)
print(f"xml_validated={len(xml_files)}")

for path in toml_files:
    with path.open("rb") as handle:
        tomllib.load(handle)
print(f"toml_validated={len(toml_files)}")

for path in properties_files:
    for lineno, line in enumerate(path.read_text(errors="ignore").splitlines(), start=1):
        stripped = line.strip()
        if not stripped or stripped.startswith(("#", "!")):
            continue
        if "=" not in stripped and ":" not in stripped:
            raise SystemExit(f"invalid properties line: {path}:{lineno}: {stripped}")
print(f"properties_validated={len(properties_files)}")
PY
  )
}

check_no_webview_stack() {
  print_header "WebView/Cordova/Capacitor Scan"
  (
    cd "$REPO_ROOT"
    grep -R "WebView\|Cordova\|Capacitor" android/app/src || true
  )
}

run_gradle_verification() {
  print_header "Gradle Verification"
  (
    cd "$ANDROID_DIR"
    ./gradlew clean
    ./gradlew testDebugUnitTest
    ./gradlew assembleDebug
  )
}

check_auth_csrf() {
  print_header "Local Backend CSRF Probe"
  local status=0
  curl -sS -i "http://127.0.0.1:8787/api/v1/auth/csrf" || status=$?
  if [[ "$status" -ne 0 ]]; then
    echo "curl_failed_exit_code=$status"
  fi
}

main() {
  print_repo_identity
  print_key_file_snapshot
  validate_tracked_files
  check_no_webview_stack
  run_gradle_verification
  check_auth_csrf
}

main "$@"
