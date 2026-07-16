# FreeAnima 常用配方 — 权威依赖图（优于 package.json 长链）
# 需安装 just: https://github.com/casey/just
help:
  just -l

# 并行启动 Hub + Vite Web（HMR :4173；需 just ≥1.0，不依赖 [parallel]）
dev:
  #!/usr/bin/env bash
  set -euo pipefail
  bun run dev:hub &
  hub_pid=$!
  bun run dev:web &
  web_pid=$!
  trap 'kill "$hub_pid" "$web_pid" 2>/dev/null || true; wait "$hub_pid" "$web_pid" 2>/dev/null || true' EXIT INT TERM
  wait "$hub_pid" "$web_pid"

build-cli:
  bun run build:cli:executable

# 构建后安装单文件到独立前缀（默认 ~/.anima/standalone）
install-cli: build-cli
  bun scripts/install-cli.ts --skip-build

# 仅重装已有 dist/anima-executable/anima（CI / 已 build）
install-cli-from-dist:
  bun scripts/install-cli.ts --skip-build
