---
title: Repository topology
---

# Repository topology

> Living map of the monorepo layout after single-package migration (Phase 0).
> **Code is SSOT** — when this doc drifts, fix it in the same PR as structural changes.

## Packages

| Package           | Path            | Role                                                                          |
| ----------------- | --------------- | ----------------------------------------------------------------------------- |
| `freeanima`       | repository root | Habitat runtime, CLI, capabilities, features, shells — **one `package.json`** |
| `@freeanima/site` | `site/`         | Astro/Starlight 文档站（**独立** `package.json` + `bun.lock`，非 workspace）  |

根目录 **无** `workspaces`；`site/` 与产品依赖图分离，内容（`docs/`、`po/`、`messages/`）仍与产品同仓。

## Product source (`src/`)

```
src/
├── kernel/          # 日志、事件总线、无业务依赖
├── core/            # 配置、PG schema、repos、LLM 工具
├── runtime/         # 对话轮次、目标、流水线
├── platform/        # 组合根：Habitat、连接器、SAP、slash commands
├── capabilities/    # acp, memory, tools, mcp-*, llm-openai, …
├── features/        # chat, console, task, vault, diary, …
├── shared/          # habitat-rpc, habitat-contract, rpc-contract, vault-crypto
├── frontend/        # ui-kit, shell-sdk, shell-ui
├── app/
│   ├── cli/         # `anima` CLI（无内层 src/）
│   └── shell/
│       ├── tauri/   # Portal：src-tauri + bridge + spa
│       └── web/     # 浏览器 / PWA
└── satellites/      # companion（spa/ + lib/ + server/ 浏览器·dev host）

内层 Vite SPA 根目录统一称 **`spa/`**（原 `app/`），与交付层 `src/app/` 区分。壳层/卫星的非 SPA 模块用 **`lib/`**（原内层 `src/`）。
```

## Root-level (non-`src/`)

| Path                     | Role                                                       |
| ------------------------ | ---------------------------------------------------------- |
| `tests/`                 | 集成测试与 helpers（非产品模块）                           |
| `scripts/`               | 构建、检查、迁移脚本                                       |
| `docs/`                  | 英文概念/指南文档（源）                                    |
| `docs/.generated/zh_CN/` | po4a 构建产物（gitignore；site 构建时从 `po/zh_CN/` 生成） |
| `messages/`              | Paraglide `en.json` / `zh-cn.json`                         |
| `po/`                    | gettext PO（恢复文档 i18n 时用）                           |
| `site/`                  | 文档站（独立 install / build）                             |

## Module resolution

- TypeScript：`tsconfig.json` 单一配置；`@freeanima/*` 通过 `compilerOptions.paths` 映射到 `src/**`。
- Vite 壳层：`src/frontend/shell-ui/vite/paths.ts` 与别名（`@chat/*`、`@habitat/*` 等）；feature UI 在 `ui/spa/`。
- 产品无 workspace 子 `package.json`；`site/` 为兄弟目录独立包。

## 护栏

- `tsconfig.base.json` paths：`@freeanima/*`、`@paraglide/*`（与 Vite `module-aliases.ts` 手动对齐）。
- [`.agent/rules/code-layers.md`](../../.agent/rules/code-layers.md)：目录层依赖约定（`src/<layer>/` 前缀）。
- 已移除 `check-package-cycles.ts`（单包无 workspace 图）。
- 分发形态仅 **source** 与 **Linux standalone**（`build:cli:executable`）；无 npm/`@freeanima/cli` 发布，无产品 Docker 镜像。

## 文档站 i18n

中文 **PO 译文冻结**（`po/zh_CN/` 保留、不再要求 agent 同步）；`docs/.generated/zh_CN/` **不入库**，site 构建时 `i18n:po4a` 从 PO 生成。PR/`bun run check` **不跑**翻译校验。详见 [`.agent/rules/i18n.md`](../.agent/rules/i18n.md)。

## 文档站构建

```bash
# 产品
bun install && bun run check

# 文档站（独立 lock）
cd site && bun install && bun run build
```

site `prebuild` 会调用根目录 `i18n:po4a` 与 `paraglide:compile`（共享 `docs/` / `messages/` SSOT）。
