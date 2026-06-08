#!/usr/bin/env bash
# semantic-release publish 阶段：发布 @freeanima/cli
# 优先 GitHub Actions OIDC（npm Trusted Publishing）；回退 NPM_TOKEN + bun publish
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

if [ ! -f "${ROOT}/cli/publish/package.json" ]; then
  echo "cli/publish 不存在，请先 bun run build:cli" >&2
  exit 1
fi

cd "${ROOT}/cli/publish"
VERSION="$(bun -p "require('./package.json').version")"
echo "发布 @freeanima/cli@${VERSION} …"

# CI：setup-node + id-token: write → npm CLI 自动走 OIDC（需 npmjs 配置 Trusted Publisher）
if [ -n "${GITHUB_ACTIONS:-}" ] && command -v npm >/dev/null 2>&1; then
  echo "使用 npm publish（OIDC / NODE_AUTH_TOKEN）"
  npm publish --access public
  exit 0
fi

# 本地 / 无 OIDC：长期 token
if [ -n "${NPM_TOKEN:-}" ]; then
  echo "使用 bun publish（NPM_TOKEN）"
  bun publish --access public
  exit 0
fi

echo "::warning::无 GitHub OIDC 且 NPM_TOKEN 未配置，跳过 @freeanima/cli npm 发布"
exit 0
