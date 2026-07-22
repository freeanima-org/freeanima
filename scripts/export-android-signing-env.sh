#!/usr/bin/env bash
# CI / 手动打包：从环境变量解码 keystore 并导出 Gradle 签名变量。
# 需预先设置 FREEANIMA_ANDROID_KEYSTORE_BASE64 及密码/别名变量。
set -euo pipefail

if [ -z "${FREEANIMA_ANDROID_KEYSTORE_BASE64:-}" ]; then
  echo "FREEANIMA_ANDROID_KEYSTORE_BASE64 未设置，跳过固定签名（使用默认 debug keystore）" >&2
  return 0 2>/dev/null || exit 0
fi

KS_PATH="${FREEANIMA_ANDROID_KEYSTORE:-/tmp/freeanima-upload.jks}"
echo "$FREEANIMA_ANDROID_KEYSTORE_BASE64" | base64 -d >"$KS_PATH"
chmod 600 "$KS_PATH"

export FREEANIMA_ANDROID_KEYSTORE="$KS_PATH"

if [ -z "${FREEANIMA_ANDROID_KEYSTORE_PASSWORD:-}" ] \
  || [ -z "${FREEANIMA_ANDROID_KEY_PASSWORD:-}" ] \
  || [ -z "${FREEANIMA_ANDROID_KEY_ALIAS:-}" ]; then
  echo "Android 签名密码或别名未完整设置" >&2
  exit 1
fi

export FREEANIMA_ANDROID_KEYSTORE_PASSWORD
export FREEANIMA_ANDROID_KEY_PASSWORD
export FREEANIMA_ANDROID_KEY_ALIAS

echo "已配置 CI Android 固定签名 keystore: $KS_PATH"
