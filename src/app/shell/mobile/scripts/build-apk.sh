#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=android-env.sh
source "$ROOT/scripts/android-env.sh"
REPO_ROOT="$(cd "$ROOT/../../../.." && pwd)"
cd "$REPO_ROOT"
bun run build:mobile
cd "$ROOT"
bunx cap sync android
cd android
./gradlew assembleDebug
APK="app/build/outputs/apk/debug/app-debug.apk"
echo "APK: $ROOT/android/$APK"
