# 前端功能原型（Feature archetypes）

> 新功能 **先选原型**，再决定 touch 哪些包。与 [`code-layers.md`](code-layers.md) 前端边界规则配合使用。

## 决策树

1. 是否需要用户可见的产品 CRUD + 实时 WS？→ **原型 A（SAP satellite）**
2. 是否是运维/配置/记忆管理类 UI，走 Hub REST？→ **原型 B（hub-rest / Admin）**
3. 是否仅是壳层设置（Hub URL、debug）？→ **原型 C（shell-sdk settings）**

## 原型 A — SAP 产品面

**示例**：chat、task、email、diary、notification

| 层               | 必须改                                          |
| ---------------- | ----------------------------------------------- |
| `core/db`        | entity component 或专用表 + migration           |
| `capabilities-*` | `*-store.ts`                                    |
| `sap-contract`   | `frames/<domain>.ts` + `router.ts`              |
| `platform`       | `service-*` + `sap/handlers/<domain>.ts`        |
| `satellite-*`    | `sap-client.ts` + `api.ts` + UI                 |
| `shell-ui`       | 路由 + `@freeanima/satellite-*/app`（不写 SAP） |

**不要**：在 `shell-ui` 内 `import @freeanima/sap-contract`；在 capabilities 内 import platform。

## 原型 B — hub-rest 运维面

**示例**：memory、config、cron、MCP、entity worlds

| 层               | 必须改                              |
| ---------------- | ----------------------------------- |
| `admin-contract` | API schema                          |
| `admin-api`      | Elysia route                        |
| `admin-frontend` | 页面（`ui-kit` + `admin-contract`） |

**不要**：import `sap-contract`；新建 `satellite-*` 包。

## 原型 C — 壳层设置

**示例**：Hub URL、remote auth、debug section

| 层                         | 必须改             |
| -------------------------- | ------------------ |
| `shell-sdk/settings`       | section 注册       |
| `app/desktop\|mobile\|web` | 原生 IPC（若需要） |

## SAP handler 模块化

新增 SAP method 时：

1. 在 `sap-contract/frames/` 增加 schema
2. 在 `platform/src/runtime/service-*.ts` 增加薄适配
3. 在 `platform/src/sap/handlers/<domain>.ts` 增加 handler 函数
4. 在 `ws-server.ts` switch 增加一行 delegate

## 前端包依赖速查

| 包               | 允许                                            | 禁止                                   |
| ---------------- | ----------------------------------------------- | -------------------------------------- |
| `ui-kit`         | react                                           | sap-contract、workspace                |
| `shell-sdk`      | kernel\*、zod                                   | sap-contract                           |
| `shell-ui`       | ui-kit、shell-sdk、satellite-\*、admin-frontend | sap-contract、深路径 import satellites |
| `admin-frontend` | admin-contract、ui-kit、shell-sdk               | sap-contract、shell-ui                 |
| `satellite-*`    | sap-contract、shell-sdk、ui-kit                 | shell-ui、admin-\*                     |

**Satellite 离线只读缓存**：列表/详情 fetch 应 cache-first 展示、`network refresh` 写回；使用 `@freeanima/shell-sdk/offline-cache`（按 `hubWsUrl` scope 隔离，写入带 `cachedAt` 信封）；离线时通过 `@freeanima/shell-sdk/react` 的 `useOfflineReadOnly()` 禁用写操作；**不要**用 Workbox 缓存 `/api` 或 `/sap`。参见 [`docs/guide/remote-access.md`](../../docs/guide/remote-access.md) PWA 离线边界。

UI 样式与复合组件约定 → [`frontend-ui.md`](frontend-ui.md)。
