#!/usr/bin/env bash
# 将 apps/cli/dist/cli.js 链接到 ~/.bun/bin/anima（shebang 为 bun，无需 bun link -g）
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CLI="${ROOT}/apps/cli/dist/cli.js"
BIN_DIR="${BUN_INSTALL:-${HOME}/.bun}/bin"
LINK="${BIN_DIR}/anima"

echo "→ 构建 @freeanima/legacy-cli …"
bun run --filter @freeanima/legacy-cli build

if [[ ! -f "$CLI" ]]; then
  echo "error: 未找到 ${CLI}，build 可能失败" >&2
  exit 1
fi

chmod +x "$CLI"
mkdir -p "$BIN_DIR"
ln -sf "$(realpath "$CLI")" "$LINK"

echo "✓ ${LINK} → $(realpath "$CLI")"

if command -v anima >/dev/null 2>&1; then
  RESOLVED="$(command -v anima)"
  if [[ "$RESOLVED" != "$LINK" ]]; then
    echo "⚠ PATH 上另有 anima: ${RESOLVED}"
    echo "  将 ${BIN_DIR} 放在 PATH 更前，或移除旧全局安装（如 pnpm 全局 bin）"
  else
    echo "✓ which anima → ${RESOLVED}"
  fi
else
  echo "→ 将 ${BIN_DIR} 加入 PATH，例如："
  echo "  export PATH=\"${BIN_DIR}:\$PATH\""
fi
