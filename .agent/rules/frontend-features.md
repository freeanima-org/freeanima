# 前端功能原型（Feature archetypes）

> 新功能 **先选原型**，再决定 touch 哪些包。与 [`code-layers.md`](code-layers.md) 前端边界规则配合使用。

## 决策树

1. 是否需要用户可见的产品 CRUD + 实时 Hub WS？→ **原型 A（Feature RPC）**
2. 是否需要 SAP attach 的独立卫星进程/壳？→ **原型 A′（SAP satellite）** — 仅 `companion`
3. 是否是运维/配置/记忆管理类 UI，走 Hub REST？→ **原型 B（hub-rest / Console）**
4. 是否仅是壳层设置（Hub URL、debug）？→ **原型 C（shell-sdk settings）**

## 原型 A — Feature RPC 产品面

**示例**：chat、task、email、diary、notification、vault、dream

| 层                               | 必须改                                                             |
| -------------------------------- | ------------------------------------------------------------------ |
| `src/core/db`                    | entity component 或专用表 + migration                              |
| `src/features/<slug>/domain`     | 域逻辑 SSOT                                                        |
| `sap-contract`                   | `feature-rpc/frames/<domain>.ts` + router 子集                     |
| `src/features/<slug>/hub/rpc.ts` | Hub RPC handler 实现                                               |
| `src/features/<slug>/ui`         | 产品 UI（`@freeanima/feature-<slug>/ui/*`）                        |
| `platform`                       | `src/features/<slug>/plugin.ts` 注册 + 必要时 `service-*` 薄适配   |
| `shell-ui`                       | 路由 lazy-load `@freeanima/feature-<slug>/ui/spa`（不写 SAP wire） |

**不要**：在 `shell-ui` 内 `import @freeanima/sap-contract`；在 capabilities 内 import platform；新建 `satellite-*` 做 chat/task 等产品面。

## 原型 A′ — SAP attach 卫星

**示例**：companion

| 层                       | 必须改                                       |
| ------------------------ | -------------------------------------------- |
| `sap-contract`           | `satellite/` + `frames/*` attach 相关 schema |
| `src/satellites/<name>/` | `sap-client` + UI（仅白名单目录）            |
| `shell-ui`               | 路由 + `@freeanima/satellite-*/app`          |

## 原型 B — hub-rest 运维面（Console）

**示例**：memory、config、cron、MCP、entity worlds（Console UI）

| 层                                               | 必须改                                                             |
| ------------------------------------------------ | ------------------------------------------------------------------ |
| `src/features/console/protocol/console-contract` | API 类型 + hub-contract re-export（schema SSOT 在 hub-contract）   |
| `src/features/console/hub/console-api`           | Elysia 薄路由 → `invokeConsoleHubHandler`                          |
| `src/features/console/ui/console`                | Console 页面（优先 `@freeanima/hub-client`，Eden Treaty 过渡弃用） |

**不要**：import `sap-contract`；新建 `satellite-*` 包。

## 原型 C — 壳层设置

**示例**：Hub URL、remote auth、debug section

| 层                                   | 必须改             |
| ------------------------------------ | ------------------ |
| `shell-sdk/settings`                 | section 注册       |
| `src/app/shell/desktop\|mobile\|web` | 原生 IPC（若需要） |

## Hub RPC / Feature method 模块化

新增 Feature RPC method 时：

1. 在 `src/shared/hub-contract/registry/` 增加 method 定义（Zod + transport meta）
2. 在 `src/shared/sap-contract/feature-rpc/frames/` 增加 schema（若尚未存在）
3. 在 `src/features/<slug>/hub/rpc.ts` 实现 handler（**禁止** import `hub-client`）
4. 在 `src/features/<slug>/plugin.ts` 注册 RPC 表
5. Feature UI `api.ts` 使用 `@freeanima/hub-client` 的 `call` / `subscribe`（WS-only 流式仍走 `sap-contract` bundled client）

Console REST method 在 `hub-contract/registry/console.ts` + `console-api/console-hub-handlers.ts`；Elysia 路由 delegate 至 `invokeConsoleHubHandler`。

SAP attach 专用 method（tool/terminal/sap.attach）仍在 [`src/platform/sap/ws-server.ts`](../../src/platform/sap/ws-server.ts) switch 内。

## 前端包依赖速查

| 包                | 允许                                                | 禁止                                          |
| ----------------- | --------------------------------------------------- | --------------------------------------------- |
| `ui-kit`          | react                                               | sap-contract、workspace                       |
| `shell-sdk`       | kernel\*、hub-rpc、vault-crypto                     | sap-contract                                  |
| `shell-ui`        | ui-kit、shell-sdk、feature-\*、satellite-\*         | sap-contract、深路径 import satellites        |
| `feature-*` UI    | hub-client、hub-contract（类型）、shell-sdk、ui-kit | 在 `hub/rpc.ts` 使用 hub-client               |
| `feature-console` | console-contract、hub-client、ui-kit、shell-sdk     | sap-contract、shell-ui、Eden Treaty（已移除） |
| `satellite-*`     | sap-contract、shell-sdk、ui-kit                     | shell-ui、admin-\*                            |

**Satellite 离线只读缓存**：列表/详情 fetch 应 cache-first 展示、`network refresh` 写回；使用 `@freeanima/shell-sdk/offline-cache`（按 `hubWsUrl` scope 隔离，写入带 `cachedAt` 信封）；离线时通过 `@freeanima/shell-sdk/react` 的 `useOfflineReadOnly()` 禁用写操作；**不要**用 Workbox 缓存 `/api` 或 `/sap`。参见 [`docs/guide/remote-access.md`](../../docs/guide/remote-access.md) PWA 离线边界。

UI 样式与复合组件约定 → [`frontend-ui.md`](frontend-ui.md)。
