# 前端功能原型（Feature archetypes）

> 新功能 **先选原型**，再决定 touch 哪些包。与 [`code-layers.md`](code-layers.md) 前端边界规则配合使用。

## 决策树

1. 是否需要用户可见的产品 CRUD + 实时 Habitat WS？→ **原型 A（Feature RPC）**
2. 是否需要不可达本机的远程工具反向调用？→ **原型 A′（remote tools host）** — 仅 Habitat 拨不到的本地应用（今日 companion Outpost；亦可未来独立工具）
3. 是否是运维/配置/记忆管理类 UI（Habitat）？→ **原型 B（Habitat RPC）** — 与原型 A 相同 protocol
4. 是否仅是壳层设置（Habitat URL、debug）？→ **原型 C（portal-sdk settings）**
5. 对端可拨号的工具？→ **MCP**（不要用远程工具注册）

## 原型 A — Feature RPC 产品面

**示例**：chat、task、email、diary、notification、vault、dream

| 层                                            | 必须改                                                                                                       |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `src/host/core/db`                            | entity component 或专用表 + migration                                                                        |
| `src/features/<slug>/domain`                  | 域逻辑 SSOT                                                                                                  |
| `rpc-contract`                                | `feature-rpc/frames/<domain>.ts` + router 子集                                                               |
| `src/features/<slug>/habitat/routes/index.ts` | Habitat RPC handler（`defineHabitatRoute`）                                                                  |
| `src/features/<slug>/ui`                      | 产品 UI（`@freeanima/feature-<slug>/ui/*`）                                                                  |
| `platform`                                    | `src/features/<slug>/plugin.ts` 注册 + 必要时 `service-*` 薄适配                                             |
| `app-ui`                                      | 路由 lazy-load `@freeanima/feature-<slug>/ui/spa`；壳 CSS 已 `@source` 整棵 `src`，一般不必再按 feature 登记 |

**不要**：在 `app-ui` 内 `import @freeanima/shared/rpc-contract`；在 capabilities 内 import platform；新建独立 satellites 树做产品面；产品面不做 `remote_tools.attach`。

## 原型 A′ — 远程工具宿主（不可达本地应用）

**示例**：companion（**伴侣浮层** / `embedded-overlay`：`createRemoteToolsHabitatAttach` 在第一方 overlay 内 attach；壳只提供窗/IPC/FS；**禁止** Node sidecar）

| 层                          | 必须改                                                                  |
| --------------------------- | ----------------------------------------------------------------------- |
| `rpc-contract`              | `remote-tools/` + `frames/*` attach / tool schema                       |
| `src/features/companion/ui` | 伴侣浮层 UI + 可选 companion/dev 本地 HTTP（**禁止** Node sidecar）     |
| 桌面壳                      | 透明窗 / click-through / 托盘 / FS；产品面仍走 Feature RPC，不做 attach |

**不要**：为 Chat/Task 等产品面新建 Outpost attach 或 `remote_tools.attach`；能 MCP 解决的不要走远程工具注册。  
**允许**：Companion 等原型 A′ 的**第一方伴侣浮层**内 `remote_tools.attach`（WebView-host）。**禁止**：Chat 等产品面 attach；禁止为 attach 再起 Node sidecar。

## 原型 B — Habitat 运维面（Habitat RPC）

**示例**：memory、config、cron、MCP、entity worlds（Habitat UI）

| 层                                               | 必须改                                                                              |
| ------------------------------------------------ | ----------------------------------------------------------------------------------- |
| `src/features/habitat/protocol/habitat-contract` | API 类型 + habitat-contract re-export（schema SSOT 在 habitat-contract）            |
| `src/features/habitat/habitat/habitat-api`       | Habitat RPC handler 实现 + REST 基础设施（health、TLS、TTS）                        |
| `src/features/habitat/plugin.ts`                 | `habitat.rpc` 注册 handler；HTTP REST path 由 habitat-contract `meta.http` 自动生成 |
| `src/features/habitat/ui/habitat`                | `@freeanima/habitat-client` `call` / `subscribe`                                    |

**不要**：import `rpc-contract` 的远程工具子集到 Habitat 运维面；在 registry 手写 legacy `/api/*` Habitat path。

## 原型 C — 壳层设置

**示例**：Habitat URL、remote auth、debug section

| 层                         | 必须改             |
| -------------------------- | ------------------ |
| `portal-sdk/settings`      | section 注册       |
| `src/app/shell/tauri\|web` | 原生 IPC（若需要） |

## Habitat RPC / Feature method 模块化

新增 Feature RPC method 时：

1. 在 `src/features/<slug>/habitat/method-defs.ts` 增加 method 定义
2. 在 `src/shared/rpc-contract/feature-rpc/frames/` 增加 schema（若尚未存在）
3. 在 `src/features/<slug>/habitat/routes/index.ts` 用 `bindHabitatRouteHandlers` 绑定 handler（**禁止** import `habitat-client`）
4. 在 `src/host/platform/habitat/habitat-router.ts` import 该 feature routes bundle
5. Feature UI `api.ts` 使用 `@freeanima/host/platform/habitat/client.ts` 的 `getTypedHabitatClient` / `call` / `subscribe`

远程工具专用 method（`tool.*` / `remote_tools.attach` / terminal）在 [`src/host/capabilities/outpost/transport/ws-server.ts`](../../src/host/capabilities/outpost/transport/ws-server.ts)。

## 前端包依赖速查

| 包             | 允许                                                         | 禁止                                                               |
| -------------- | ------------------------------------------------------------ | ------------------------------------------------------------------ |
| `ui-kit`       | react                                                        | rpc-contract、workspace                                            |
| `portal-sdk`   | kernel\*、habitat-rpc、vault-crypto                          | rpc-contract                                                       |
| `app-ui`       | ui-kit、portal-sdk、feature-\*                               | rpc-contract、深路径绕过 feature 边界                              |
| `feature-*` UI | habitat-client、habitat-contract（类型）、portal-sdk、ui-kit | 在 `habitat/routes` 使用 habitat-client；`platform/habitat` 桶文件 |

**typed Habitat client**：前端 UI 只能从 `@freeanima/host/platform/habitat/client.ts` 取 `getTypedHabitatClient`，**不要**从桶文件 `@freeanima/host/platform/habitat` 导入。

UI/UX 规范 → [`docs/ui/`](../../docs/ui/README.md)；Agent 硬约束 → [`frontend-ui.md`](frontend-ui.md)。详见 [`docs/ops/habitat-rpc.md`](../../docs/ops/habitat-rpc.md)。
