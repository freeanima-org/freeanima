# 前端功能原型（Feature archetypes）

> 新功能 **先选原型**，再决定 touch 哪些包。与 [`code-layers.md`](code-layers.md) 前端边界规则配合使用。

## 决策树

1. 是否需要用户可见的产品 CRUD + 实时 Hub WS？→ **原型 A（Feature RPC）**
2. 是否需要 SAP attach 的独立卫星进程/壳？→ **原型 A′（SAP satellite）** — 仅 `companion`
3. 是否是运维/配置/记忆管理类 UI（Console）？→ **原型 B（Console Hub RPC）** — 与原型 A 相同 wire，handler 在 `console/plugin.hub.rpc`
4. 是否仅是壳层设置（Hub URL、debug）？→ **原型 C（shell-sdk settings）**

## 原型 A — Feature RPC 产品面

**示例**：chat、task、email、diary、notification、vault、dream

| 层                                        | 必须改                                                             |
| ----------------------------------------- | ------------------------------------------------------------------ |
| `src/core/db`                             | entity component 或专用表 + migration                              |
| `src/features/<slug>/domain`              | 域逻辑 SSOT                                                        |
| `sap-contract`                            | `feature-rpc/frames/<domain>.ts` + router 子集                     |
| `src/features/<slug>/hub/routes/index.ts` | Hub RPC handler（`defineHubRoute`）                                |
| `src/features/<slug>/ui`                  | 产品 UI（`@freeanima/feature-<slug>/ui/*`）                        |
| `platform`                                | `src/features/<slug>/plugin.ts` 注册 + 必要时 `service-*` 薄适配   |
| `shell-ui`                                | 路由 lazy-load `@freeanima/feature-<slug>/ui/spa`（不写 SAP wire） |

**不要**：在 `shell-ui` 内 `import @freeanima/sap-contract`；在 capabilities 内 import platform；新建 `satellite-*` 做 chat/task 等产品面。

## 原型 A′ — SAP attach 卫星

**示例**：companion

| 层                       | 必须改                                       |
| ------------------------ | -------------------------------------------- |
| `sap-contract`           | `satellite/` + `frames/*` attach 相关 schema |
| `src/satellites/<name>/` | `sap-client` + UI（仅白名单目录）            |
| `shell-ui`               | 路由 + `@freeanima/satellite-*/app`          |

## 原型 B — Console 运维面（Hub RPC）

**示例**：memory、config、cron、MCP、entity worlds（Console UI）

| 层                                               | 必须改                                                                      |
| ------------------------------------------------ | --------------------------------------------------------------------------- |
| `src/features/console/protocol/console-contract` | API 类型 + hub-contract re-export（schema SSOT 在 hub-contract）            |
| `src/features/console/hub/console-api`           | Hub RPC handler 实现 + REST 基础设施（health、TLS、TTS）                    |
| `src/features/console/plugin.ts`                 | `hub.rpc` 注册 handler；HTTP REST path 由 hub-contract `meta.http` 自动生成 |
| `src/features/console/ui/console`                | `@freeanima/hub-client` `call` / `subscribe`                                |

**不要**：import `sap-contract`；在 registry 手写 legacy `/api/*` Hub path（主 Hub 统一为 `/hub/rpc/v1/*`）；新建 `satellite-*` 包。

## 原型 C — 壳层设置

**示例**：Hub URL、remote auth、debug section

| 层                                   | 必须改             |
| ------------------------------------ | ------------------ |
| `shell-sdk/settings`                 | section 注册       |
| `src/app/shell/desktop\|mobile\|web` | 原生 IPC（若需要） |

## Hub RPC / Feature method 模块化

新增 Feature RPC method 时：

1. 在 `src/features/<slug>/hub/method-defs.ts` 增加 method 定义（Zod + `dualTransportMeta` / `wsOnlyMeta` / `binaryHttpMeta`）
2. 在 `src/shared/sap-contract/feature-rpc/frames/` 增加 schema（若尚未存在）
3. 在 `src/features/<slug>/hub/routes/index.ts` 用 `bindHubRouteHandlers(methodDefs, handlers)` 绑定 handler（**禁止** import `hub-client`）
4. 在 `src/platform/hub/hub-router.ts` import 该 feature routes bundle；`platform/hub/feature-method-defs.ts` 聚合 `method-defs.ts` 供浏览器 client registry
5. Feature UI `api.ts` 使用 `@freeanima/platform/hub/client.ts` 的 `getTypedSatelliteHubClient` / `call` / `subscribe`

Console method：`hub-contract/registry/console.ts` + `console/hub/routes/index.ts`（`defineHubRouteFromDef`）。业务传输：**WS** `/hub/rpc/v1`（HubRPC envelope）；**HTTP** `/hub/rpc/v1/{path}`（REST GET/POST，plain JSON）。

SAP attach 专用 method（tool/terminal/sap.attach）仍在 [`src/platform/sap/ws-server.ts`](../../src/platform/sap/ws-server.ts) switch 内。

## 前端包依赖速查

| 包                | 允许                                                | 禁止                                                   |
| ----------------- | --------------------------------------------------- | ------------------------------------------------------ |
| `ui-kit`          | react                                               | sap-contract、workspace                                |
| `shell-sdk`       | kernel\*、hub-rpc、vault-crypto                     | sap-contract                                           |
| `shell-ui`        | ui-kit、shell-sdk、feature-\*、satellite-\*         | sap-contract、深路径 import satellites                 |
| `feature-*` UI    | hub-client、hub-contract（类型）、shell-sdk、ui-kit | 在 `hub/routes` 使用 hub-client；`platform/hub` 桶文件 |
| `feature-console` | console-contract、hub-client、ui-kit、shell-sdk     | sap-contract、shell-ui、Eden Treaty（已移除）          |
| `satellite-*`     | sap-contract、shell-sdk、ui-kit                     | shell-ui、admin-\*                                     |

**Satellite 离线缓存**：列表/详情 fetch 应 cache-first 展示、`network refresh` 写回；使用 `@freeanima/frontend/shell-sdk/offline-cache`（按 `hubWsUrl` + subject scope 隔离）。**Tier 2 可写**模块通过 `offline-module-registry` 注册 adapter，离线写经 outbox flush；shell-ui `OfflineSyncBootstrap` 展示跨模块待同步计数。**不要**用 Workbox 缓存 `/api` 或 `/sap`。参见 [`docs/guide/remote-access.md`](../../docs/guide/remote-access.md) 与 [`docs/guide/offline-platform.md`](../../docs/guide/offline-platform.md)。

**typed Hub client**：前端 UI 只能从 `@freeanima/platform/hub/client.ts` 取 `getTypedSatelliteHubClient` / `getTypedConsoleHubClient`，**不要**从桶文件 `@freeanima/platform/hub` 导入——后者会 re-export 运行时聚合的 `hubRouter`（`hub-router.ts` 值级导入全部 feature server routes → hub service → `core/db/pg/client.ts` → `import { SQL } from "bun"`），会把整个服务端图打进浏览器 bundle，导致 `Rolldown failed to resolve import "bun"`、`build:web` / standalone 打包失败。`client.ts` 对 `hub-router` 仅 `import type`（`verbatimModuleSyntax` 下会被擦除），故安全。首次 `call` 前会通过 `platform/hub/install-client-method-registry.ts` 安装 **client-side method registry**（`STATIC_METHOD_REGISTRY` + 各 feature `hub/method-defs.ts` 聚合，无 handler）；def SSOT 在 feature `method-defs.ts`，与 `hubRouter.defs` 对齐由 `hub-method-registry.test.ts` 守护。`dev:hub` / standalone `anima service` **不会**自动 `build:web`；源码部署须先手动构建，开发用 `dev:web` HMR。

UI 样式与复合组件约定 → [`frontend-ui.md`](frontend-ui.md)。
