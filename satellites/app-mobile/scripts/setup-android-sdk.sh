#!/usr/bin/env bash
# 安装 Android SDK（API 35）到 ~/Android/Sdk；Debian/Ubuntu 需已装 openjdk-21-jdk
set -e
SDK="${ANDROID_HOME:-$HOME/Android/Sdk}"
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

echo "Accepting licenses..."
yes | sdkmanager --licenses >/dev/null 2>&1 || true

echo "Installing platform-tools, android-35, build-tools 35.0.0..."
sdkmanager "platform-tools" "platforms;android-35" "build-tools;35.0.0"

PROP="$(cd "$(dirname "$0")/../android" && pwd)/local.properties"
printf 'sdk.dir=%s\n' "$SDK" >"$PROP"
echo "Wrote $PROP"

sdkmanager --list_installed | grep -E 'platform-tools|android-35|build-tools;35' || true
echo "Done. Source: source satellites/app-mobile/scripts/android-env.sh"
