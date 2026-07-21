# FreeAnima 日常入口。CI / husky 仍用 package.json；本地开发配方集中在此。
# 安装 just: https://github.com/casey/just · 列出：just --list
# 公开配方均依赖 `_deps`（bun install）；已装好时通常 <1s。

set shell := ["bash", "-euo", "pipefail", "-c"]

stylelint_globs := 'src/frontend/**/spa/**/*.css src/frontend/**/lib/**/*.css src/features/**/ui/**/*.css src/satellites/**/spa/**/*.css src/app/shell/desktop/**/spa/**/*.css src/app/shell/web/**/spa/**/*.css'

default:
  @just --choose

# 确保依赖已安装（新 worktree / 缺 node_modules 时必需）
[private]
_deps:
  bun install

# 仅装依赖
deps: _deps

# ─── 开发（源码 / worktree）──────────────────────────────────────────
# Habitat ≥10000 / Web :5000；见 scripts/dev.sh。可选 HABITAT_PORT（或 legacy HUB_PORT）/ WEB_DEV_PORT。
dev: _deps
  bash "{{justfile_directory()}}/scripts/dev.sh"

# 仅 Habitat（可附加：just habitat -- --port 12001）
habitat *args: _deps
  bun run dev:habitat -- {{args}}

# @deprecated 0.9.3 后删除 — 请用 `just habitat`
hub *args: _deps
  bun run dev:hub -- {{args}}

# 仅 Vite Web（需已设 FREEANIMA_URL 或默认 proxy→2658）
web *args: _deps
  bun run dev:web -- {{args}}

# Electron 桌面壳开发
windows: _deps
  bun run dev:windows

# Android 调试安装
android: _deps
  bun run debug:android

# ─── 质量门禁 ───────────────────────────────────────────────────────

# PR 前：typecheck + lint + import-depth + pg-sql-arrays + stylelint + format + test:changed
check: _deps
  bun run check

typecheck: _deps
  bun run typecheck

lint: _deps
  bun run lint

lint-fix: _deps
  oxlint --fix .

stylelint-fix: _deps
  stylelint --fix {{stylelint_globs}}

fmt: _deps
  oxfmt .

fmt-check: _deps
  bun run format

# 全量单元 + 集成（串行）
test: _deps
  bun run test

test-unit: _deps
  bun run test:unit

test-integration: _deps
  bun run test:integration

test-changed: _deps
  bun run test:changed

test-coverage: _deps
  bun test --coverage --pass-with-no-tests

coverage-cobertura: _deps
  bun scripts/run-tests.ts --coverage && bun scripts/lcov-to-cobertura.ts

coverage-threshold: _deps
  bun scripts/check-coverage-threshold.ts

# ─── 数据库（需 DATABASE_URL）───────────────────────────────────────

db-generate: _deps
  bun run db:generate

db-migrate: _deps
  bun run db:migrate

# ─── 构建 / 安装 ────────────────────────────────────────────────────

build-web: _deps
  bun run build:web

build-cli: _deps
  bun run build:cli:executable

# Windows 安装包（electron-builder；≡ bun run package:windows）
pack-windows: _deps
  bun run package:windows

# 构建后安装到独立前缀（默认 ~/.anima/standalone；PATH shim → ~/.local/bin）
install-cli: build-cli
  bun scripts/install-cli.ts --skip-build

# 仅重装已有 dist（跳过 build）
install-cli-from-dist: _deps
  bun scripts/install-cli.ts --skip-build

brand-icons: _deps
  bun scripts/generate-brand-icons.ts

setup-fbx: _deps
  bun run setup:fbx

# ─── i18n ───────────────────────────────────────────────────────────

i18n-check: _deps
  bun run i18n:check:all

i18n-po4a: _deps
  bun run i18n:po4a

i18n-messages-master: _deps
  bun run i18n:messages:master

i18n-messages-compile: _deps
  bun run i18n:messages:compile

# 一次性 / 维护（不进 package.json）
i18n-messages-bootstrap-po: _deps
  bun scripts/bootstrap-messages-po.ts

i18n-docs-cfg: _deps
  bun scripts/gen-po4a-cfg.ts

i18n-docs-migrate-layout: _deps
  bun scripts/migrate-docs-po-layout.ts

# ─── 本地工具 / 归档 ───────────────────────────────────────────────

# Habitat 内存采样：just memory-sample -- --habitat-url http://127.0.0.1:12001 --stage full
memory-sample *args: _deps
  bun scripts/memory-sample.ts {{args}}

migrate-tasks: _deps
  bun scripts/archive/migrate-tasks-to-entities.ts

migrate-email: _deps
  bun scripts/archive/migrate-email-to-entities.ts

recover-tasks: _deps
  bun scripts/archive/recover-tasks-from-message-history.ts
