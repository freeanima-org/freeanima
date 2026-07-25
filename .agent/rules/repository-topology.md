---
title: Repository topology
---

# Repository topology

> Living map after **Phase 1 host/client**（风巢 #11640）.
> **Code is SSOT** — when this doc drifts, fix it in the same PR as structural changes.

## Packages

| Package           | Path            | Role                                                                          |
| ----------------- | --------------- | ----------------------------------------------------------------------------- |
| `freeanima`       | repository root | Habitat runtime, CLI, capabilities, features, shells — **one `package.json`** |
| `@freeanima/site` | `site/`         | Astro/Starlight 文档站（**独立** `package.json` + `bun.lock`，非 workspace）  |

根目录 **无** 产品 `workspaces` 子包；`site/` 与产品依赖图分离。

## Product source (`src/`)

```
src/
├── host/                 # Habitat 进程栈
│   ├── kernel/           # 日志、事件总线
│   ├── core/             # 配置、PG、LLM 原语、mask、host i18n
│   ├── engine/           # 原 runtime/：conversation、turn、loop、pipeline
│   ├── capabilities/     # acp, self, memory, tools(+slash), outpost, connectors, mcp-*, llm-openai
│   └── platform/         # 组合根；service/（原 platform/runtime）
├── client/               # Portal chrome
│   ├── portal-sdk/       # Shell/Habitat 客户端 SDK + typed Habitat client
│   └── app-frame/        # AppFrame / Rail / 设置 chrome（原 app-ui）
├── ui-kit/               # 设计系统（与 shared 并列；仅 client 消费者；无协议）
├── features/<slug>/      # 纵向：ui + domain + habitat + protocol + plugin
├── shared/               # 无 React：habitat-rpc/client/contract、rpc-contract、vault-crypto
└── portal/               # 入口实现（四形态；见 docs/modules/portal.md）
    ├── app/{tauri,web}   # 应用形态 = Shell
    ├── extension/        # 浏览器形态（MV3；runtime/ + features/*）
    └── cli/              # CLI 形态（anima）
```

MCP 形态入口实现在 `host/capabilities/mcp-server`（**不在** `portal/`）。

**Habitat 管理台** = 普通 `features/habitat`（与 chat/task 同形），不为它单开目录或 i18n catalog。

### 依赖方向（CI：`bun scripts/check-layer-deps.ts`）

```
portal/cli, features(server) → platform → capabilities → engine → core → kernel
shared → kernel（无 React）
ui-kit → kernel（极少）；仅 client 侧引用
features/*/ui → ui-kit + client/portal-sdk + shared（及暂允许的 host/core 类型/工具）
client/app-frame → features/*/ui + portal-sdk + ui-kit
portal/app、portal/extension → client 层（同原 shell）
host ↛ client / ui-kit（platform habitat client re-export 为过渡豁免）
```

## i18n catalogs

| Catalog  | Path             | Consumers                                                         |
| -------- | ---------------- | ----------------------------------------------------------------- |
| **site** | `messages/site/` | 文档站落地页（`landing_*`）                                       |
| **ui**   | `messages/ui/`   | Portal + 全部 feature UI（含 habitat 管理台）                     |
| **host** | `messages/host/` | Habitat 进程：提示词片段、错误文案（`@freeanima/host/core/i18n`） |

根目录 `messages/en.json` / `zh-cn.json` 为 **ui catalog 镜像**（兼容既有工具）；inlang 主工程指向 `messages/ui/`。全局 `config.i18n.locale` / `config.i18n.timezone` 驱动 Host。

## Module resolution

- TypeScript：`tsconfig.base.json` paths `@freeanima/*` → `src/*`；故 `@freeanima/host/core/...`、`@freeanima/client/portal-sdk/...`、`@freeanima/ui-kit/...`。
- Vite：`src/client/app-frame/vite/` 别名与 paths 对齐。

## 护栏

- `bun scripts/check-import-depth.ts` — 相对路径深度
- `bun scripts/check-layer-deps.ts` — 层依赖矩阵
- 已移除空的 `platform/admin-*` 遗留目录

## 文档站

```bash
bun install && just check
cd site && bun install && bun run build
```
