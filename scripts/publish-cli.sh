#!/usr/bin/env bash
# semantic-release publish 阶段：发布 @freeanima/cli（需 NPM_TOKEN）
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

if [ -z "${NPM_TOKEN:-}" ]; then
  echo "::warning::NPM_TOKEN 未配置，跳过 @freeanima/cli npm 发布（GitHub Release 不受影响）"
  exit 0
fi

if [ ! -f "${ROOT}/cli/publish/package.json" ]; then
  echo "cli/publish 不存在，请先 bun run build:cli" >&2
  exit 1
fi

cd "${ROOT}/cli/publish"
echo "发布 @freeanima/cli@$(bun -p "require('./package.json').version") …"
bun publish --access public
