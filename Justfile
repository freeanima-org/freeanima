# FreeAnima 常用配方 — 权威依赖图（优于 package.json 长链）
# 需安装 just: https://github.com/casey/just

build-cli:
  bun run build:cli:executable

# 构建后安装单文件到独立前缀（默认 ~/.anima/standalone）
install-cli: build-cli
  bun scripts/install-cli.ts --skip-build

# 仅重装已有 dist/anima-executable/anima（CI / 已 build）
install-cli-from-dist:
  bun scripts/install-cli.ts --skip-build
