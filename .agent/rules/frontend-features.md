# 前端功能原型（Feature archetypes）

> 新功能 **先选原型**，再决定 touch 哪些包。与 [`code-layers.md`](code-layers.md) 前端边界规则配合使用。

## 决策树

1. 是否需要用户可见的产品 CRUD + 实时 Habitat WS？→ **原型 A（Feature RPC）**
2. 是否需要 SAP attach 的本地工具反向调用？→ **原型 A′（SAP attach host）** — 仅 `companion`（壳主进程内嵌，非独立 sidecar 进程）
3. 是否是运维/配置/记忆管理类 UI（Habitat）？→ **原型 B（Habitat RPC）** — 与原型 A 相同 wire，handler 在 `console/plugin.hub.rpc`
4. 是否仅是壳层设置（Habitat URL、debug）？→ **原型 C（shell-sdk settings）**

## 原型 A — Feature RPC 产品面

**示例**：chat、task、email、diary、notification、vault、dream

| 层                                            | 必须改                                                                                                                        |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `src/core/db`                                 | entity component 或专用表 + migration                                                                                         |
| `src/features/<slug>/domain`                  | 域逻辑 SSOT                                                                                                                   |
| `sap-contract`                                | `feature-rpc/frames/<domain>.ts` + router 子集                                                                                |
| `src/features/<slug>/habitat/routes/index.ts` | Habitat RPC handler（`defineHubRoute`）                                                                                       |
| `src/features/<slug>/ui`                      | 产品 UI（`@freeanima/feature-<slug>/ui/*`）                                                                                   |
| `platform`                                    | `src/features/<slug>/plugin.ts` 注册 + 必要时 `service-*` 薄适配                                                              |
| `shell-ui`                                    | 路由 lazy-load `@freeanima/feature-<slug>/ui/spa`（不写 SAP wire）；壳 CSS 已 `@source` 整棵 `src`，一般不必再按 feature 登记 |

**不要**：在 `shell-ui` 内 `import @freeanima/sap-contract`；在 capabilities 内 import platform；新建 `satellite-*` 做 chat/task 等产品面。

## 原型 A′ — SAP attach 宿主（仅 companion）

**示例**：companion（Electron main 同进程 `createSatelliteHub`；overlay 经 IPC 收 runtime）

| 层                       | 必须改                                                           |
| ------------------------ | ---------------------------------------------------------------- |
| `sap-contract`           | `satellite/` + `frames/*` attach / tool schema                   |
| `src/satellites/<name>/` | attach host + UI（仅白名单；**禁止**再加独立 sidecar 进程）      |
| 桌面壳                   | preload IPC / 静态资产 HTTP；产品面仍走 Feature RPC，不做 attach |

**不要**：为 Chat/Task 等产品面新建 `satellites/*` 或 `sap.attach`；不要把 attach 放进 renderer。

## 原型 B — Habitat 运维面（Habitat RPC）

**示例**：memory、config、cron、MCP、entity worlds（Habitat UI）

| 层                                               | 必须改                                                                          |
| ------------------------------------------------ | ------------------------------------------------------------------------------- |
| `src/features/habitat/protocol/habitat-contract` | API 类型 + habitat-contract re-export（schema SSOT 在 habitat-contract）        |
| `src/features/habitat/habitat/habitat-api`       | Habitat RPC handler 实现 + REST 基础设施（health、TLS、TTS）                    |
| `src/features/habitat/plugin.ts`                 | `hub.rpc` 注册 handler；HTTP REST path 由 habitat-contract `meta.http` 自动生成 |
| `src/features/habitat/ui/habitat`                | `@freeanima/habitat-client` `call` / `subscribe`                                |

**不要**：import `sap-contract`；在 registry 手写 legacy `/api/*` Habitat path（主 Habitat 统一为 `/rpc/v1/*`）；新建 `satellite-*` 包。

## 原型 C — 壳层设置

**示例**：Habitat URL、remote auth、debug section

| 层                                   | 必须改             |
| ------------------------------------ | ------------------ |
| `shell-sdk/settings`                 | section 注册       |
| `src/app/shell/desktop\|mobile\|web` | 原生 IPC（若需要） |

## Habitat RPC / Feature method 模块化

新增 Feature RPC method 时：

1. 在 `src/features/<slug>/habitat/method-defs.ts` 增加 method 定义（Zod + `dualTransportMeta` / `wsOnlyMeta` / `binaryHttpMeta`）
2. 在 `src/shared/sap-contract/feature-rpc/frames/` 增加 schema（若尚未存在）
3. 在 `src/features/<slug>/habitat/routes/index.ts` 用 `bindHubRouteHandlers(methodDefs, handlers)` 绑定 handler（**禁止** import `habitat-client`）
4. 在 `src/platform/habitat/habitat-router.ts` import 该 feature routes bundle；`platform/habitat/feature-method-defs.ts` 聚合 `method-defs.ts` 供浏览器 client registry
5. Feature UI `api.ts` 使用 `@freeanima/platform/habitat/client.ts` 的 `getTypedSatelliteHabitatClient` / `call` / `subscribe`

Habitat method：`habitat-contract/registry/habitat.ts` + `console/habitat/routes/index.ts`（`defineHubRouteFromDef`）。业务传输：**WS** `/rpc/v1`（HubRPC envelope）；**HTTP** `/rpc/v1/{path}`（REST GET/POST，plain JSON）。

SAP attach 专用 method（tool/terminal/sap.attach）仍在 [`src/platform/sap/ws-server.ts`](../../src/platform/sap/ws-server.ts) switch 内。

## 前端包依赖速查

| 包                | 允许                                                        | 禁止                                                               |
| ----------------- | ----------------------------------------------------------- | ------------------------------------------------------------------ |
| `ui-kit`          | react                                                       | sap-contract、workspace                                            |
| `shell-sdk`       | kernel\*、habitat-rpc、vault-crypto                         | sap-contract                                                       |
| `shell-ui`        | ui-kit、shell-sdk、feature-\*、satellite-\*                 | sap-contract、深路径 import satellites                             |
| `feature-*` UI    | habitat-client、habitat-contract（类型）、shell-sdk、ui-kit | 在 `habitat/routes` 使用 habitat-client；`platform/habitat` 桶文件 |
| `feature-console` | console-contract、habitat-client、ui-kit、shell-sdk         | sap-contract、shell-ui、Eden Treaty（已移除）                      |
| `satellite-*`     | sap-contract、shell-sdk、ui-kit                             | shell-ui、admin-\*                                                 |

**Satellite 离线缓存**：列表/详情 fetch 应 cache-first 展示、`network refresh` 写回；使用 `@freeanima/frontend/shell-sdk/offline-cache`（按 `hubWsUrl` + subject scope 隔离）。**Tier 2 可写**模块通过 `offline-module-registry` 注册 adapter，离线写经 outbox flush；shell-ui `OfflineSyncBootstrap` 展示跨模块待同步计数。**不要**用 Workbox 缓存 `/api` 或 `/sap`。参见 [`docs/guide/remote-access.md`](../../docs/guide/remote-access.md) 与 [`docs/guide/offline-platform.md`](../../docs/guide/offline-platform.md)。

**typed Habitat client**：前端 UI 只能从 `@freeanima/platform/habitat/client.ts` 取 `getTypedSatelliteHabitatClient` / `getTypedConsoleHabitatClient`，**不要**从桶文件 `@freeanima/platform/habitat` 导入——后者会 re-export 运行时聚合的 `hubRouter`（`habitat-router.ts` 值级导入全部 feature server routes → hub service → `core/db/pg/client.ts` → `import { SQL } from "bun"`），会把整个服务端图打进浏览器 bundle，导致 `Rolldown failed to resolve import "bun"`、`build:web` / standalone 打包失败。`client.ts` 对 `habitat-router` 仅 `import type`（`verbatimModuleSyntax` 下会被擦除），故安全。首次 `call` 前会通过 `platform/habitat/install-client-method-registry.ts` 安装 **client-side method registry**（`STATIC_METHOD_REGISTRY` + 各 feature `habitat/method-defs.ts` 聚合，无 handler）；def SSOT 在 feature `method-defs.ts`，与 `hubRouter.defs` 对齐由 `habitat-method-registry.test.ts` 守护。`dev:hub` / standalone `anima service` **不会**自动 `build:web`；源码部署须先手动构建，开发用 `dev:web` HMR。

UI 样式与复合组件约定 → [`frontend-ui.md`](frontend-ui.md)。
