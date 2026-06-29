#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=android-env.sh
source "$ROOT/scripts/android-env.sh"
cd "$ROOT"
if [ "${MOBILE_DEBUG:-}" = "1" ]; then
  bun run build:debug
else
  bun run build
fi
bunx cap sync android

echo ">>> Gradle assembleDebug（首次可能需数分钟）..."
cd "$ROOT/android"
./gradlew assembleDebug --console=plain

APK="$ROOT/android/app/build/outputs/apk/debug/app-debug.apk"

echo ">>> 检查 adb 设备..."
adb devices
DEVICE_COUNT="$(adb devices | awk 'NR>1 && $2=="device"{c++} END{print c+0}')"
if [ "$DEVICE_COUNT" -lt 1 ]; then
  echo "未检测到 adb device，请检查 USB 调试与 adb devices" >&2
  exit 1
fi

echo ">>> 安装 APK..."
adb install -r "$APK"

echo ">>> 启动 APP..."
adb shell am start -n org.freeanima.app/.MainActivity
