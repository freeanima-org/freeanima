# Code layers and dependencies

> **Repository** layering (distinct from cognitive Consciousness/Self/Memory/Estate in [`docs/concepts/architecture.md`](../../docs/concepts/architecture.md)). **文档约定 + PR review** 把关；import 路径由 `tsconfig.base.json` paths（`@freeanima/*` → `src/*` 等）+ `tsgo` 保障。

## Layer topology

Classic runtime stack（纵向依赖，高 → 低）：

```
app → platform → capabilities → runtime → core → kernel
```

与运行时栈**并列**、由层依赖约定约束的目录：

| Directory         | Import prefix（`@freeanima/*` → `src/*`） | Role                                                      |
| ----------------- | ----------------------------------------- | --------------------------------------------------------- |
| `src/shared/`     | `@freeanima/shared/habitat-rpc` 等        | Habitat method SSOT、多传输客户端、SAP wire、加密         |
| `src/frontend/`   | `@freeanima/frontend/ui-kit` 等           | 壳层 UI 与集成 SDK                                        |
| `features/`       | `@freeanima/features/{slug}/`             | 产品功能纵向模块（plugin + hub + protocol + ui + domain） |
| `src/satellites/` | `@freeanima/satellites/companion/`        | **仅** SAP attach 型卫星壳（`companion`）                 |

| Layer            | Directory           | Package               | Responsibility                                                                         |
| ---------------- | ------------------- | --------------------- | -------------------------------------------------------------------------------------- |
| **kernel**       | `src/kernel/`       | `@freeanima/kernel`   | Hook, EventBus, logging                                                                |
| **core**         | `src/core/`         | `@freeanima/core`     | PG schema, `db/pg` repos, config, tool/LLM/compress/hooks                              |
| **runtime**      | `runtime/`          | `@freeanima/runtime`  | Conversation, turn, loop, pipeline, Engine factory                                     |
| **capabilities** | `src/capabilities/` | `capabilities-*` (8)  | acp, identity, llm-openai, mcp-client, mcp-server, memory, satellite, tools            |
| **platform**     | `src/platform/`     | `@freeanima/platform` | Composition root, ports, connectors, CLI wiring, feature registry                      |
| **app**          | `app/`              | CLI / shells          | CLI、desktop/mobile 壳（安装包内嵌 `web/dist`）；浏览器/PWA 仍由 Habitat `/web/*` 托管 |

### Habitat（hub-rest）

| 包名                          | 物理路径                                      | 说明                                                    |
| ----------------------------- | --------------------------------------------- | ------------------------------------------------------- |
| `@freeanima/feature-habitat`  | `features/habitat/`                           | Habitat feature（plugin、Habitat UI SSOT、build 工具）  |
| `@freeanima/console-api`      | `features/habitat/habitat/habitat-api/`       | Habitat HTTP 服务（Habitat RPC REST 分发、静态 `/web`） |
| `@freeanima/console-contract` | `features/habitat/protocol/habitat-contract/` | Habitat wire 类型                                       |

Habitat UI 源码 SSOT：`features/habitat/ui/habitat/`。Paraglide/build 工具：`features/habitat/build/`。Shell 路由经 `@freeanima/feature-habitat/ui/spa`。

### Feature 模块（`features/<slug>/`）

内置 plugin 在 [`src/platform/features/builtin-plugins.ts`](../../src/platform/features/builtin-plugins.ts) 注册；Habitat RPC 由 `features/*/habitat/routes/index.ts`（`defineHubRoute`）实现，经 [`src/platform/habitat/habitat-router.ts`](../../src/platform/habitat/habitat-router.ts) 聚合；[`src/platform/sap/ws-server.ts`](../../src/platform/sap/ws-server.ts) 经 `getFeatureRpcHandler` 分发（**非** SAP attach）。

典型子目录：`plugin.ts`、`hub/`、`protocol/`（re-export `@freeanima/sap-contract/feature-rpc`）、`ui/`、`domain/`。

chat / task / vault / diary / email / notification / dream / console 等产品面走 **Feature RPC**；`src/satellites/` 仅保留 companion。

### `@freeanima/core` subpaths

`db`, `db/pg`, `db/schema`, `repos` (types only), `config`, `util`, `tokenizer`, `provider`, `tool`, `llm`, `compress`, `hooks`, `skill`

### `@freeanima/runtime` subpaths

`conversation`, `turn`, `loop`, `goal`, `pipeline`

### `@freeanima/platform` subpaths

`ports`, `config`, `logging`, `commands`, `bootstrap`, `connectors/*`, `sap/*`, `features/*`

### `@freeanima/sap-contract` subpaths（`src/shared/sap-contract/`）

`.`、`./satellite`、`./feature-rpc`、`./frames/*` — satellite attach 与 feature Habitat RPC 分入口。

## Dependency allow/deny matrix

Readable mirror of层依赖约定（**非**自动化脚本）。**When rules change, update this section in the same PR.**

Dependency direction (high → low): `app` / `platform` / `features` → `capabilities` → `runtime` → `core` → `kernel`. Lower layers must not import higher layers.

| Source directory                              | Allowed `@freeanima/*` (package root)                                                                                                                                                           | Explicitly forbidden                                                                                                                    |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `src/kernel/`                                 | `kernel`, `kernel-*`                                                                                                                                                                            | all other workspace packages                                                                                                            |
| `src/core/`                                   | `kernel`, `kernel-*`, `core`                                                                                                                                                                    | `runtime`, `capabilities-*`, `platform`, …                                                                                              |
| `runtime/`                                    | `kernel`, `kernel-*`, `core`, `runtime`                                                                                                                                                         | **`platform`**, **`capabilities-*`**                                                                                                    |
| `src/capabilities/<pkg>/`                     | `kernel`, `kernel-*`, `core`, **`src/core/db/pg`**, **`src/core/db/schema`**, own `capabilities-<pkg>`, `sap-contract`                                                                          | **`runtime`**, **`platform`**, **other `capabilities-*`**, **`feature-*`**                                                              |
| `src/platform/`, `app/`, `tests/`             | all workspace packages                                                                                                                                                                          | —                                                                                                                                       |
| `features/habitat/habitat/habitat-api/`       | same as `src/platform/`（nested workspace package）                                                                                                                                             | —                                                                                                                                       |
| `features/habitat/protocol/habitat-contract/` | `kernel`, `kernel-*`（devDeps：`platform`, `core`, `console-api` 仅类型解析）                                                                                                                   | **`platform`**, **`core`**, **`console-api`**                                                                                           |
| `features/<slug>/`                            | `core`, `platform` (hub connectors), `admin-*` (console only), `sap-contract`, `shell-sdk`, `ui-kit`, `vault-crypto`, `shared/companion-motion` (companion only), **other `feature-*`（无环）** | `runtime`, arbitrary `capabilities-*`；**禁止 feature 环依赖**                                                                          |
| `src/satellites/<name>/`                      | `sap-contract`, `shell-sdk`, `ui-kit`, `vault-crypto`, `kernel`, `kernel-*`, matching `feature-*` shim                                                                                          | **`shell-ui`**, **`admin-*`**, **`platform`**, **`core`**, **`runtime`**, **`capabilities-*`** — **only `companion` directory allowed** |
| `src/shared/habitat-rpc/`                     | `kernel`, `kernel-*`, `habitat-rpc`                                                                                                                                                             | all other workspace packages                                                                                                            |
| `src/shared/sap-contract/`                    | `kernel`, `kernel-*`, `sap-contract`, `habitat-rpc`                                                                                                                                             | all other workspace packages                                                                                                            |
| `src/shared/vault-crypto/`                    | `kernel`, `kernel-*`, `vault-crypto`                                                                                                                                                            | all other workspace packages                                                                                                            |
| `src/frontend/ui-kit/`                        | `kernel`, `kernel-*`                                                                                                                                                                            | **`sap-contract`**, other workspace packages                                                                                            |
| `src/frontend/shell-sdk/`                     | `kernel`, `kernel-*`, `habitat-rpc`, `vault-crypto`                                                                                                                                             | **`sap-contract`**, other workspace packages                                                                                            |
| `src/frontend/shell-ui/`                      | `ui-kit`, `shell-sdk`, `feature-*`, `satellite-*`, `kernel`, `kernel-*`                                                                                                                         | **`sap-contract`**；禁止深路径 import `src/satellites/`（用 `@freeanima/feature-*/ui/*`）                                               |

Notes aligned with the checker:

- **Scan scope**: `@freeanima/*` imports in `*.ts` / `*.tsx` **and** `dependencies` in each layer's `package.json`.
- **Exemptions** (import scan only): paths under `tests/` or `test-helpers/`, `*.test.ts` / `*.spec.ts`, all `src/app/cli/` source files, and build path helpers (`features/habitat/build/*.ts`, selected `src/frontend/shell-ui/vite/*.ts`). Production code in other layers is still checked.
- **Capabilities isolation**: `src/capabilities/<src>` must not depend on `@freeanima/capabilities-<other>` where `<other> ≠ <src>`，亦不可依赖任何 `feature-*`。产品域 SSOT 在 `features/*/domain/`；**platform / console-api / tests** 直接 import `@freeanima/feature-*/domain`。
- **Features 互引**：`features/<slug>` **可以**依赖其他 `@freeanima/feature-*`（如 task → tag）；**禁止环依赖**。优先直接 import，勿为「隔离」引入多余 DI。架构简单优先于为规则绕弯。
- **Platform ↔ feature**: `@freeanima/feature-*` 在 `@freeanima/platform` 的 **`dependencies`** 中声明（register-tools、connectors、plugin 注册）。
- **Satellites**: only **`companion`** under `src/satellites/`; product UIs live in `features/*/ui`. Do not import `platform`, `runtime`, `core`, or arbitrary `capabilities-*` — use [`src/shared/sap-contract`](../../src/shared/sap-contract/) + [`src/frontend/shell-sdk`](../../src/frontend/shell-sdk/) + [`src/frontend/ui-kit`](../../src/frontend/ui-kit/)。功能原型见 [`frontend-features.md`](frontend-features.md)。
- **Tests**: production layers may use `@freeanima/platform` test helpers in test files / devDependencies; the checker skips exempt paths above.

## Port wiring at composition root

Boot phases: [`src/platform/boot/`](../../src/platform/boot/). Entry: [`src/platform/serve.ts`](../../src/platform/serve.ts).

- `registerCapabilityInjection()` wires vault helpers from `@freeanima/platform/config` into `@freeanima/core/config`
- `registerFeatures()` wires builtin `FeaturePlugin` list（Habitat RPC handlers）
- **runtime / core / capabilities** must not depend on `@freeanima/platform` in production code (tests may use platform test helpers as devDependency)
- Connectors and Habitat import `@freeanima/platform/ports` only — not the full boot graph

## RuntimeContext

Single process-wide context after boot (`initRuntimeContext` in [`src/platform/runtime/runtime-context.ts`](../../src/platform/runtime/runtime-context.ts)):

- `deps: FullRuntimeDeps`
- `app: AppRuntimePort`

## Runtime Catalog (Registry instances)

**Forbidden**: module-level registry singletons; direct PG connections inside runtime / capabilities (use `@freeanima/core/db/pg/*` functions instead of `engine.repos`).

**Allowed**: `runWithToolContext` — `@freeanima/core/tool`（经 `@freeanima/runtime/loop` re-export）

**Capabilities 访问 PG**：entity 等域直接 import `@freeanima/core/db/pg/{domain}`（如 task/email 的 `listEntities`）；单测用 `mock.module("@freeanima/core/db/pg/…")`（见 [`testing.md`](testing.md)）。需 runtime 注入 engine 函数时用共享 factory（如 `createEnginePort`），勿复制 `*-port.ts` 文件。
