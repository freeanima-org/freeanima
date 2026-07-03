# Package naming (RFC #1)

Workspace package names reflect the layer topology in [`code-layers.md`](code-layers.md):

| Shape           | Pattern                          | Example                                                       |
| --------------- | -------------------------------- | ------------------------------------------------------------- |
| Layer aggregate | `@freeanima/{layer}`             | `kernel`, `core`, `runtime`, `platform`                       |
| Capability pack | `@freeanima/capabilities-{slug}` | `capabilities-memory`, `capabilities-tools`                   |
| Feature module  | `@freeanima/feature-{slug}`      | `feature-chat`, `feature-console`                             |
| Shared wire     | `@freeanima/{name}`              | `hub-rpc`, `sap-contract`, `vault-crypto`（`shared/`）        |
| Frontend shell  | `@freeanima/{name}`              | `ui-kit`, `shell-sdk`, `shell-ui`（`frontend/`）              |
| Entry           | `@freeanima/cli`                 | CLI only                                                      |
| Satellite       | `@freeanima/satellite-{slug}`    | `satellite-companion`（`satellites/` 白名单）                 |
| Admin wire      | `@freeanima/admin-contract`      | Admin Hub wire（`features/console/protocol/admin-contract/`） |
| Admin REST      | `@freeanima/admin-api`           | Admin Elysia routes（`features/console/hub/admin-api/`）      |

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
| `@freeanima/sap-contract` | shared       | SAP + Feature RPC wire；`./satellite`、`./feature-rpc` 子入口                          |
| `@freeanima/shell-sdk`    | frontend     | 壳层 manifest/settings/Hub 连通（依赖 hub-rpc）                                        |
| `@freeanima/shell-ui`     | frontend     | 壳层 SPA                                                                               |

**Deprecated prefixes** (must not appear in new packages): `engine-*`, `life-*`, `storage-*`, `mechanism-*`, `orchestration-*`, `service-*`, `connectors-*`, `admin-frontend`（已移除；用 `feature-console`）。

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
