#!/usr/bin/env bash
# 安装 Android SDK（API 35）到 ~/Android/Sdk；Debian/Ubuntu 需已装 openjdk-21-jdk
# 已安装的包会跳过 sdkmanager，便于 CI 命中 SDK 缓存后快速 no-op
set -e

# GitHub Actions runner 常预置 ANDROID_HOME（如 /usr/local/lib/android/sdk）；
# CI 固定用 ~/Android/Sdk，与 .github/actions/cache-android-sdk 路径对齐。
if [ -n "${GITHUB_ACTIONS:-}" ]; then
  SDK="$HOME/Android/Sdk"
else
  SDK="${ANDROID_HOME:-$HOME/Android/Sdk}"
fi

mkdir -p "$SDK/cmdline-tools"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

if [ ! -x "$SDK/cmdline-tools/latest/bin/sdkmanager" ]; then
  echo "Downloading command-line tools..."
  wget -q -O "$TMP/cmdline-tools.zip" \
    "https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip"
  unzip -q -o "$TMP/cmdline-tools.zip" -d "$TMP"
  rm -rf "$SDK/cmdline-tools/latest"
  mv "$TMP/cmdline-tools" "$SDK/cmdline-tools/latest"
fi

export ANDROID_HOME="$SDK"
export ANDROID_SDK_ROOT="$SDK"
export PATH="$SDK/cmdline-tools/latest/bin:$SDK/platform-tools:$PATH"

if [ -n "${GITHUB_ENV:-}" ]; then
  {
    echo "ANDROID_HOME=$SDK"
    echo "ANDROID_SDK_ROOT=$SDK"
  } >>"$GITHUB_ENV"
fi

need_install=0
[ -d "$SDK/platform-tools" ] || need_install=1
[ -d "$SDK/platforms/android-35" ] || need_install=1
[ -d "$SDK/build-tools/35.0.0" ] || need_install=1

# NDK 与 scripts/android-pack-targets.ts ANDROID_NDK_PACKAGE 对齐；纳入 cache-android-sdk
NDK_VER="27.0.12077973"
need_ndk=0
[ -d "$SDK/ndk/$NDK_VER" ] || need_ndk=1

if [ "$need_install" -eq 1 ] || [ "$need_ndk" -eq 1 ]; then
  echo "Accepting licenses..."
  yes | sdkmanager --licenses >/dev/null 2>&1 || true
fi

if [ "$need_install" -eq 1 ]; then
  echo "Installing platform-tools, android-35, build-tools 35.0.0..."
  sdkmanager "platform-tools" "platforms;android-35" "build-tools;35.0.0"
else
  echo "Android SDK packages already present, skipping sdkmanager install"
fi

if [ "$need_ndk" -eq 1 ]; then
  echo "Installing NDK $NDK_VER..."
  sdkmanager "ndk;$NDK_VER"
else
  echo "Android NDK $NDK_VER already present, skipping"
fi

PROP_DIR="$(cd "$(dirname "$0")/.." && pwd)/packages/frontend/portal/app/tauri/src-tauri/gen/android"
if [ -d "$PROP_DIR" ]; then
  printf 'sdk.dir=%s\n' "$SDK" >"$PROP_DIR/local.properties"
  echo "Wrote $PROP_DIR/local.properties (sdk.dir=$SDK)"
fi

sdkmanager --list_installed | grep -E "platform-tools|android-35|build-tools;35|ndk;$NDK_VER" || true
echo "Done. Source: source scripts/android-env.sh"
