# Package naming (RFC #1)

> **单包迁移（2026）**：逻辑包名（`@freeanima/*`）仍通过 `tsconfig.json` paths 解析；物理上根 `package.json` 承载产品依赖；`site/` 为**独立**文档站（自有 `package.json` + `bun.lock`，非 workspace）。目录拓扑见 [`docs/concepts/repository-topology.md`](../docs/concepts/repository-topology.md)。

Workspace package names reflect the layer topology in [`code-layers.md`](code-layers.md):

| Shape           | Pattern                          | Example                                                               |
| --------------- | -------------------------------- | --------------------------------------------------------------------- |
| Layer aggregate | `@freeanima/{layer}`             | `kernel`, `core`, `runtime`, `platform`                               |
| Capability pack | `@freeanima/capabilities-{slug}` | `capabilities-memory`, `capabilities-tools`                           |
| Feature module  | `@freeanima/feature-{slug}`      | `feature-chat`, `feature-console`                                     |
| Shared wire     | `@freeanima/{name}`              | `hub-rpc`, `sap-contract`, `vault-crypto`（`src/shared/`）            |
| Frontend shell  | `@freeanima/{name}`              | `ui-kit`, `shell-sdk`, `shell-ui`（`src/frontend/`）                  |
| Entry           | `@freeanima/cli`                 | CLI only                                                              |
| Satellite       | `@freeanima/satellite-{slug}`    | `satellite-companion`（`src/satellites/` 白名单）                     |
| Console wire    | `@freeanima/console-contract`    | Console Hub wire（`src/features/console/protocol/console-contract/`） |
| Console REST    | `@freeanima/console-api`         | Console Elysia routes（`src/features/console/hub/console-api/`）      |

## Valid layer packages

| Package                   | Layer / dir  | Notes                                                                                  |
| ------------------------- | ------------ | -------------------------------------------------------------------------------------- |
| `@freeanima/kernel`       | kernel       | subpaths: `/logging`, `/hooks`, `/eventbus`                                            |
| `@freeanima/core`         | core         | subpaths: `/db`, `/repos`, `/tool`, `/llm`, …                                          |
| `@freeanima/runtime`      | runtime      | subpaths: `/conversation`, `/turn`, `/loop`, `/goal`, `/pipeline`                      |
| `@freeanima/platform`     | platform     | subpaths: `/ports`, `/config`, `/connectors/*`, `/features/*`                          |
| `capabilities-*`          | capabilities | 8 packs（acp, identity, llm-openai, mcp-client, mcp-server, memory, satellite, tools） |
| `feature-*`               | features     | plugin + hub + protocol + ui + domain                                                  |
| `@freeanima/cli`          | entry        | documented only                                                                        |
| `@freeanima/ui-kit`       | frontend     | 共享 React UI（shadcn + composite）                                                    |
| `@freeanima/hub-rpc`      | shared       | Hub RPC 传输（connect / req / res / evt）                                              |
| `@freeanima/hub-contract` | shared       | Hub method SSOT（Zod + 静态 transport 元信息）                                         |
| `@freeanima/hub-client`   | shared       | Hub 多传输客户端（call / subscribe + HTTP/WS dispatch）                                |
| `@freeanima/sap-contract` | shared       | SAP + Feature RPC wire；`./satellite`、`./feature-rpc` 子入口                          |
| `@freeanima/shell-sdk`    | frontend     | 壳层 manifest/settings/Hub 连通（依赖 hub-rpc）                                        |
| `@freeanima/shell-ui`     | frontend     | 壳层 SPA                                                                               |

**Deprecated prefixes** (must not appear in new packages): `engine-*`, `life-*`, `storage-*`, `mechanism-*`, `orchestration-*`, `service-*`, `connectors-*`, `feature-console`（已移除；用 `feature-console`）。

Layer dependency rules: [`code-layers.md`](code-layers.md).

## `@freeanima/ui-kit` exports

| Subpath               | 用途                                                               |
| --------------------- | ------------------------------------------------------------------ |
| `.`                   | FormField、ListDetailLayout、viewport hooks、shadcn 原语 re-export |
| `./globals.css`       | Tailwind v4 + shadcn 主题 CSS 变量（各 app `styles.css` 引入）     |
| `./components/ui`     | shadcn 原语（Button、Dialog、Card…）                               |
| `./composite`         | ConfirmDialog、ActionSheet、StatusAlert、EmptyState                |
| `./form` / `./layout` | 表单与列表/详情布局                                                |
| `./styles.css`        | safe-area 等共享样式                                               |
