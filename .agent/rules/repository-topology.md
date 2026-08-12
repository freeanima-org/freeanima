---
title: Repository topology
---

# Repository topology

> Living map after **Phase 1 host/client**（风巢 #11640）.
> **Code is SSOT** — when this doc drifts, fix it in the same PR as structural changes.

## Packages

| Package           | Path            | Role                                                                                      |
| ----------------- | --------------- | ----------------------------------------------------------------------------------------- |
| `freeanima`       | repository root | Habitat runtime, CLI, capabilities, features, shells — **根 `package.json` + `bun.lock`** |
| `@freeanima/site` | `site/`         | Astro/Starlight 文档站（独立 `package.json`；根 `workspaces: ["site"]`，共用根 lock）     |

根产品依赖集中在仓库根；`site/` 为 workspace 成员，不另维护 `bun.lock`。

## Product source (`src/`)

```
src/
├── host/                 # Habitat 进程栈
│   ├── kernel/           # 日志、事件总线
│   ├── core/             # 配置、PG、Redis 原语（cache/kv/lock）、LLM 原语、mask、时区
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

**Habitat 管理台** = 普通 `features/habitat`（与 chat/task 同形），不为它单开目录。

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

## 文案语言

产品 UI 与 `docs/**` 直接写**简体中文**（无 Paraglide / po4a）。术语见 [`i18n/glossary.md`](../../i18n/glossary.md)；规则见 [`i18n.md`](i18n.md)。`config.i18n.timezone` 仅保留时区。

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
