#!/usr/bin/env bash
# 生成 Android upload keystore 并写入 GitHub Actions Secrets（不入库 keystore）。
set -euo pipefail

REPO="${GITHUB_REPO:-freeanima-org/freeanima}"
FORCE=0

usage() {
  cat <<'EOF'
用法: setup-android-upload-keystore.sh [--force] [--repo owner/name]

生成 upload keystore，经 gh secret set 写入仓库 Secrets：
  FREEANIMA_ANDROID_KEYSTORE_BASE64
  FREEANIMA_ANDROID_KEYSTORE_PASSWORD
  FREEANIMA_ANDROID_KEY_PASSWORD
  FREEANIMA_ANDROID_KEY_ALIAS

默认若上述 Secret 已存在则跳过；--force 轮换密钥（已装旧 APK 用户需先卸载）。
EOF
}

while [ $# -gt 0 ]; do
  case "$1" in
    --force) FORCE=1; shift ;;
    --repo) REPO="$2"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "未知参数: $1" >&2; usage >&2; exit 1 ;;
  esac
done

SECRET_NAMES=(
  FREEANIMA_ANDROID_KEYSTORE_BASE64
  FREEANIMA_ANDROID_KEYSTORE_PASSWORD
  FREEANIMA_ANDROID_KEY_PASSWORD
  FREEANIMA_ANDROID_KEY_ALIAS
)

if [ "$FORCE" -eq 0 ]; then
  existing=()
  for name in "${SECRET_NAMES[@]}"; do
    if gh secret list -R "$REPO" --json name -q ".[].name" | grep -qx "$name"; then
      existing+=("$name")
    fi
  done
  if [ "${#existing[@]}" -gt 0 ]; then
    echo "以下 Secret 已存在于 $REPO，跳过（使用 --force 轮换）："
    printf '  - %s\n' "${existing[@]}"
    exit 0
  fi
fi

command -v keytool >/dev/null || { echo "需要 keytool（JDK）" >&2; exit 1; }
command -v gh >/dev/null || { echo "需要 gh CLI" >&2; exit 1; }
command -v openssl >/dev/null || { echo "需要 openssl" >&2; exit 1; }

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

STORE_PASS="$(openssl rand -base64 24)"
KEY_PASS="$STORE_PASS"
ALIAS="freeanima"
KS="$TMP/freeanima-upload.jks"

keytool -genkeypair -v \
  -keystore "$KS" \
  -alias "$ALIAS" \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000 \
  -storepass "$STORE_PASS" \
  -keypass "$KEY_PASS" \
  -dname "CN=FreeAnima, OU=Mobile, O=FreeAnima"

gh secret set FREEANIMA_ANDROID_KEYSTORE_BASE64 -R "$REPO" -b "$(base64 -w0 "$KS")"
gh secret set FREEANIMA_ANDROID_KEYSTORE_PASSWORD -R "$REPO" -b "$STORE_PASS"
gh secret set FREEANIMA_ANDROID_KEY_PASSWORD -R "$REPO" -b "$KEY_PASS"
gh secret set FREEANIMA_ANDROID_KEY_ALIAS -R "$REPO" -b "$ALIAS"

echo "已在 $REPO 写入 Android 签名 Secrets（keystore 未落盘）。"
if [ "$FORCE" -eq 1 ]; then
  echo "已轮换密钥：已安装旧 canary/release APK 的用户需先卸载再安装新包。"
fi
