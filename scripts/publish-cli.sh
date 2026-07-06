#!/usr/bin/env bash
# Release workflow publish job：：经 GitHub Actions OIDC 发布 @freeanima/cli
# 须 npmjs Trusted Publisher（release.yml + @freeanima/cli）；本地发包用 bun run publish:cli + npm login
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

if [ -z "${GITHUB_ACTIONS:-}" ]; then
  echo "publish-cli.sh 仅用于 GitHub Actions OIDC 发布；本地请 bun run publish:cli" >&2
  exit 1
fi

if [ ! -f "${ROOT}/src/app/cli/publish/package.json" ]; then
  echo "src/app/cli/publish 不存在，请先 bun run build:cli" >&2
  exit 1
fi

cd "${ROOT}/src/app/cli/publish"
VERSION="$(bun -p "require('./package.json').version")"
echo "发布 @freeanima/cli@${VERSION} …"

# 不用 setup-node / PATH 上的 npm（GHA 上可能损坏）；bunx 拉取 npm 11+ 以支持 Trusted Publishing
NPM=(bunx npm@11)
NPM_VERSION="$("${NPM[@]}" --version)"
echo "npm: bunx npm@11 (${NPM_VERSION})"

if ! awk -v v="${NPM_VERSION}" 'BEGIN {
  split(v, p, ".");
  if (p[1] < 11 || (p[1] == 11 && p[2] < 5) || (p[1] == 11 && p[2] == 5 && p[3] < 1)) exit 1
}'; then
  echo "npm ${NPM_VERSION} 不支持 OIDC Trusted Publishing，需 >= 11.5.1" >&2
  exit 1
fi

echo "使用 npm publish（GitHub Actions OIDC）"
"${NPM[@]}" publish --access public
