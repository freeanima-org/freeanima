#!/usr/bin/env bash
# FreeAnima Linux standalone installer (curl | bash).
# SSOT in-repo; also served at https://freeanima.com/install after site build.
#
# Usage:
#   curl -fsSL https://freeanima.com/install | bash
#   curl -fsSL https://freeanima.com/install | CHANNEL=canary bash
#   curl -fsSL https://raw.githubusercontent.com/freeanima-org/freeanima/main/scripts/install.sh | bash
#
# Env:
#   CHANNEL=release|canary   (default: release)
#   VERSION=vX.Y.Z           (optional pin; implies release-style tag download)
#   FREEANIMA_INSTALL_PREFIX (default: ~/.anima/standalone)
#   FREEANIMA_HOME           (data dir root; default: ~/.anima — used for bin shim)
set -euo pipefail

REPO="freeanima-org/freeanima"
ASSET_NAME="anima-linux-x64.tar.gz"
GITHUB_API="https://api.github.com"
GITHUB_DL="https://github.com/${REPO}/releases"

error() {
  printf 'freeanima install: %s\n' "$*" >&2
  exit 1
}

info() {
  printf 'freeanima install: %s\n' "$*"
}

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || error "缺少命令: $1"
}

os="$(uname -s | tr '[:upper:]' '[:lower:]')"
arch="$(uname -m)"
case "$os-$arch" in
  linux-x86_64 | linux-amd64) ;;
  *)
    error "当前仅支持 Linux x64（检测到 ${os}-${arch}）。见 https://freeanima.com/docs/guide/install/"
    ;;
esac

require_cmd curl
require_cmd tar
require_cmd mktemp
require_cmd mkdir
require_cmd chmod
require_cmd ln
require_cmd rm
require_cmd cp
require_cmd mv

CHANNEL="${CHANNEL:-release}"
VERSION="${VERSION:-}"
HOME_DIR="${HOME:?HOME 未设置}"
ANIMA_HOME="${FREEANIMA_HOME:-${HOME_DIR}/.anima}"
PREFIX="${FREEANIMA_INSTALL_PREFIX:-${ANIMA_HOME}/standalone}"
BIN_DIR="${ANIMA_HOME}/bin"

case "$CHANNEL" in
  release | canary) ;;
  *)
    error "无效 CHANNEL（须为 release 或 canary）: ${CHANNEL}"
    ;;
esac

if [[ -n "$VERSION" && "$CHANNEL" == "canary" ]]; then
  error "VERSION 与 CHANNEL=canary 不能同时使用；pin 版本时请用 CHANNEL=release（或省略 CHANNEL）"
fi

# Warn if installing into a FreeAnima checkout (upgrade will refuse unsafe prefixes).
if [[ -f "${PWD}/package.json" ]] && grep -q '"name"[[:space:]]*:[[:space:]]*"freeanima"' "${PWD}/package.json" 2>/dev/null; then
  case "$PREFIX" in
    "${PWD}" | "${PWD}"/*)
      error "拒绝安装到 FreeAnima monorepo 内（${PREFIX}）。请设置 FREEANIMA_INSTALL_PREFIX 到独立目录（默认 ~/.anima/standalone）。"
      ;;
  esac
  info "提示: 当前目录像是 FreeAnima checkout；安装前缀为 ${PREFIX}"
fi

normalize_tag() {
  local raw="$1"
  if [[ "$raw" =~ ^[0-9]+\.[0-9]+ ]]; then
    printf 'v%s' "$raw"
  else
    printf '%s' "$raw"
  fi
}

# Extract browser_download_url for ASSET_NAME from GitHub release JSON on stdin.
extract_asset_url() {
  if command -v python3 >/dev/null 2>&1; then
    python3 -c '
import json, sys
want = "'"${ASSET_NAME}"'"
try:
    data = json.load(sys.stdin)
except Exception:
    sys.exit(1)
assets = data.get("assets") or []
for a in assets:
    if a.get("name") == want and a.get("browser_download_url"):
        print(a["browser_download_url"])
        sys.exit(0)
sys.exit(2)
'
    return $?
  fi
  # Fallback: fragile grep (no python3)
  local url
  url="$(
    tr -d '\n' |
      grep -oE "\"browser_download_url\"[[:space:]]*:[[:space:]]*\"[^\"]+${ASSET_NAME}\"" |
      head -1 |
      sed -E 's/.*"browser_download_url"[[:space:]]*:[[:space:]]*"([^"]+)".*/\1/'
  )" || true
  [[ -n "${url:-}" ]] || return 2
  printf '%s\n' "$url"
}

resolve_download_url() {
  local api_url fallback_url tag json_tmp http_code

  if [[ -n "$VERSION" ]]; then
    tag="$(normalize_tag "$VERSION")"
    api_url="${GITHUB_API}/repos/${REPO}/releases/tags/${tag}"
    fallback_url="${GITHUB_DL}/download/${tag}/${ASSET_NAME}"
  elif [[ "$CHANNEL" == "canary" ]]; then
    tag="canary"
    api_url="${GITHUB_API}/repos/${REPO}/releases/tags/canary"
    fallback_url="${GITHUB_DL}/download/canary/${ASSET_NAME}"
  else
    tag="latest"
    api_url="${GITHUB_API}/repos/${REPO}/releases/latest"
    fallback_url="${GITHUB_DL}/latest/download/${ASSET_NAME}"
  fi

  json_tmp="$(mktemp)"
  http_code="$(
    curl -sS -L -w '%{http_code}' -o "$json_tmp" \
      -H 'Accept: application/vnd.github+json' \
      -H 'User-Agent: freeanima-install' \
      -H 'X-GitHub-Api-Version: 2022-11-28' \
      "$api_url" || printf '000'
  )"
  # http_code is appended after body file; strip to last 3 digits
  http_code="${http_code: -3}"

  if [[ "$http_code" == "200" ]]; then
    if url="$(extract_asset_url <"$json_tmp")"; then
      rm -f "$json_tmp"
      printf '%s\n' "$url"
      return 0
    fi
  fi
  rm -f "$json_tmp"

  info "GitHub API 未返回 ${ASSET_NAME}，回退直链（tag=${tag}）"
  printf '%s\n' "$fallback_url"
}

TMPDIR_INSTALL="$(mktemp -d)"
cleanup() {
  rm -rf "$TMPDIR_INSTALL"
}
trap cleanup EXIT

info "channel=${CHANNEL}${VERSION:+ version=${VERSION}} → prefix=${PREFIX}"
DOWNLOAD_URL="$(resolve_download_url)"
info "下载 ${DOWNLOAD_URL}"

TARBALL="${TMPDIR_INSTALL}/${ASSET_NAME}"
if ! curl -fL --progress-bar -o "$TARBALL" \
  -H 'User-Agent: freeanima-install' \
  "$DOWNLOAD_URL"; then
  error "下载失败。请确认 Release 已挂载 ${ASSET_NAME}：https://github.com/${REPO}/releases"
fi

EXTRACT_DIR="${TMPDIR_INSTALL}/extract"
mkdir -p "$EXTRACT_DIR"
tar -xzf "$TARBALL" -C "$EXTRACT_DIR"

ANIMA_SRC=""
if [[ -f "${EXTRACT_DIR}/anima" ]]; then
  ANIMA_SRC="${EXTRACT_DIR}/anima"
else
  # Nested directory layout (defensive)
  for candidate in "${EXTRACT_DIR}"/*/anima; do
    if [[ -f "$candidate" ]]; then
      ANIMA_SRC="$candidate"
      break
    fi
  done
fi
[[ -n "$ANIMA_SRC" && -f "$ANIMA_SRC" ]] || error "tarball 中未找到 anima 可执行文件"

mkdir -p "$PREFIX" "$BIN_DIR"
chmod 700 "$ANIMA_HOME" 2>/dev/null || true

DEST="${PREFIX}/anima"
DEST_NEW="${PREFIX}/anima.new"
cp "$ANIMA_SRC" "$DEST_NEW"
chmod 755 "$DEST_NEW"
if [[ -e "$DEST" ]]; then
  mv -f "$DEST" "${PREFIX}/anima.old" 2>/dev/null || rm -f "$DEST"
fi
mv -f "$DEST_NEW" "$DEST"
rm -f "${PREFIX}/anima.old"

ln -sfn "$DEST" "${BIN_DIR}/anima"

info "已安装: ${DEST}"
info "PATH shim: ${BIN_DIR}/anima → ${DEST}"

if "$DEST" --version >/dev/null 2>&1; then
  info "版本: $($DEST --version 2>/dev/null | head -1)"
else
  info "已写入二进制（无法执行 --version；请检查架构/权限）"
fi

case ":${PATH}:" in
  *":${BIN_DIR}:"*) ;;
  *)
    printf '\n'
    info "请将 ${BIN_DIR} 加入 PATH，例如："
    printf '  echo '\''export PATH="%s:$PATH"'\'' >> ~/.bashrc && source ~/.bashrc\n' "$BIN_DIR"
    printf '  # zsh: 写入 ~/.zshrc 后重新打开终端\n'
    ;;
esac

printf '\n'
info "下一步（本脚本不写配置、不起服务）："
printf '  1. 配置 ~/.anima/config.yaml（至少 database.url）— 见 https://freeanima.com/docs/guide/install/\n'
printf '  2. anima service start\n'
printf '  3. 之后升级: anima upgrade   # 或 anima upgrade --channel canary\n'
printf '\n'
