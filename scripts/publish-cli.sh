#!/usr/bin/env bash
# semantic-release publish 阶段：经 GitHub Actions OIDC 发布 @freeanima/cli
# 须 npmjs Trusted Publisher（release.yml + @freeanima/cli）；本地发包用 bun run publish:cli + npm login
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

if [ -z "${GITHUB_ACTIONS:-}" ]; then
  echo "publish-cli.sh 仅用于 GitHub Actions OIDC 发布；本地请 bun run publish:cli" >&2
  exit 1
fi

if [ ! -f "${ROOT}/cli/publish/package.json" ]; then
  echo "cli/publish 不存在，请先 bun run build:cli" >&2
  exit 1
fi

cd "${ROOT}/cli/publish"
VERSION="$(bun -p "require('./package.json').version")"
echo "发布 @freeanima/cli@${VERSION} …"

resolve_npm() {
  local candidate
  for candidate in "${ROOT}"/node_modules/.bun/npm@*/node_modules/npm/bin/npm; do
    if [ -x "$candidate" ]; then
      echo "$candidate"
      return 0
    fi
  done
  command -v npm
}

NPM="$(resolve_npm)"
NPM_VERSION="$("${NPM}" --version)"
echo "npm: ${NPM} (${NPM_VERSION})"

# Trusted Publishing 需 npm CLI >= 11.5.1
if ! awk -v v="${NPM_VERSION}" 'BEGIN {
  split(v, p, ".");
  if (p[1] < 11 || (p[1] == 11 && p[2] < 5) || (p[1] == 11 && p[2] == 5 && p[3] < 1)) exit 1
}'; then
  echo "npm ${NPM_VERSION} 不支持 OIDC Trusted Publishing，需 >= 11.5.1" >&2
  exit 1
fi

echo "使用 npm publish（GitHub Actions OIDC）"
"${NPM}" publish --access public
