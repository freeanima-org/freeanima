# Package naming (RFC #1)

Workspace package names reflect the six-layer model:

| Shape           | Pattern                          | Example                                                                |
| --------------- | -------------------------------- | ---------------------------------------------------------------------- |
| Layer aggregate | `@freeanima/{layer}`             | `kernel`, `core`, `runtime`, `platform`                                |
| Capability pack | `@freeanima/capabilities-{slug}` | `capabilities-memory`, `capabilities-tools`                            |
| Entry           | `@freeanima/cli`                 | CLI only                                                               |
| Shell UI        | `@freeanima/shell-ui`            | 桌面/移动统一壳层 SPA（路由/导航/设置宿主，无 SAP wire）               |
| UI kit          | `@freeanima/ui-kit`              | 共享 React UI（shadcn 原语 + FormField、Layout、ACP dock），无 Hub/SAP |
| Shell SDK       | `@freeanima/shell-sdk`           | 壳层集成（manifest、settings、Hub auth/offline-cache），依赖 hub-rpc   |
| Admin wire      | `@freeanima/admin-contract`      | Admin Hub wire 类型与边界工具（`platform/admin-contract/`）            |

## Valid layer packages

| Package                | Layer        | Notes                                                             |
| ---------------------- | ------------ | ----------------------------------------------------------------- |
| `@freeanima/kernel`    | kernel       | subpaths: `/logging`, `/hooks`, `/eventbus`                       |
| `@freeanima/core`      | core         | subpaths: `/db`, `/repos`, `/tool`, `/llm`, …                     |
| `@freeanima/runtime`   | runtime      | subpaths: `/conversation`, `/turn`, `/loop`, `/goal`, `/pipeline` |
| `@freeanima/platform`  | platform     | subpaths: `/ports`, `/config`, `/connectors/*`                    |
| `capabilities-*`       | capabilities | 11 packs; see [`code-layers.md`](code-layers.md)                  |
| `@freeanima/cli`       | entry        | documented only                                                   |
| `@freeanima/ui-kit`    | packages     | 共享 React UI（shadcn + composite）                               |
| `@freeanima/hub-rpc`   | packages     | Hub RPC 传输（connect / req / res / evt）                         |
| `@freeanima/shell-sdk` | packages     | 壳层 manifest/settings/Hub 连通（依赖 hub-rpc）                   |
| `@freeanima/shell-ui`  | packages     | 壳层 SPA                                                          |

**Deprecated prefixes** (must not appear in new packages): `engine-*`, `life-*`, `storage-*`, `mechanism-*`, `orchestration-*`, `service-*`, `connectors-*`.

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
