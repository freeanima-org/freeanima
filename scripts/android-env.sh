#!/usr/bin/env bash
# 供 build/install 脚本 source；SDK 由 setup-android-sdk.sh 安装到默认路径
# CI 固定 ~/Android/Sdk（与 cache-android-sdk / setup-android-sdk.sh 对齐，忽略 runner 预置路径）
if [ -n "${GITHUB_ACTIONS:-}" ]; then
  export ANDROID_HOME="$HOME/Android/Sdk"
else
  export ANDROID_HOME="${ANDROID_HOME:-$HOME/Android/Sdk}"
fi
export ANDROID_SDK_ROOT="${ANDROID_SDK_ROOT:-$ANDROID_HOME}"
export PATH="$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$PATH"

if [ -z "${JAVA_HOME:-}" ]; then
  if command -v java >/dev/null 2>&1; then
    JAVA_HOME="$(dirname "$(dirname "$(readlink -f "$(command -v java)")")")"
    export JAVA_HOME
  elif [ -d /usr/lib/jvm/java-21-openjdk-amd64 ]; then
    export JAVA_HOME=/usr/lib/jvm/java-21-openjdk-amd64
    export PATH="$JAVA_HOME/bin:$PATH"
  fi
fi

if ! command -v java >/dev/null 2>&1; then
  echo "未找到 java，请安装 JDK 17+（如 openjdk-21-jdk）" >&2
  exit 1
fi
if ! command -v adb >/dev/null 2>&1; then
  echo "未找到 adb，请运行: just install android" >&2
  exit 1
fi
