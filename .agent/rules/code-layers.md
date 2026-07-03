# Code layers and dependencies

> **Repository** layering (distinct from cognitive Consciousness/Self/Memory/Estate in [`docs/concepts/architecture.md`](../../docs/concepts/architecture.md)). Enforced by [`scripts/check-layer-deps.ts`](../../scripts/check-layer-deps.ts).

## Layer topology

Classic runtime stack（纵向依赖，高 → 低）：

```
app → platform → capabilities → runtime → core → kernel
```

与运行时栈**并列**、由 dep-check 单独约束的目录：

| Directory     | Package prefix                            | Role                                                          |
| ------------- | ----------------------------------------- | ------------------------------------------------------------- |
| `shared/`     | `hub-rpc`, `sap-contract`, `vault-crypto` | Hub/SAP wire、加密等跨层契约                                  |
| `frontend/`   | `ui-kit`, `shell-sdk`, `shell-ui`         | 壳层 UI 与集成 SDK                                            |
| `features/`   | `feature-*`                               | 产品功能纵向模块（plugin + hub + protocol + ui + domain）     |
| `satellites/` | `satellite-*`                             | **仅** SAP attach 型卫星壳（`companion`、`pair-programming`） |

| Layer            | Directory       | Package               | Responsibility                                                              |
| ---------------- | --------------- | --------------------- | --------------------------------------------------------------------------- |
| **kernel**       | `kernel/`       | `@freeanima/kernel`   | Hook, EventBus, logging                                                     |
| **core**         | `core/`         | `@freeanima/core`     | PG schema, `db/pg` repos, config, tool/LLM/compress/hooks                   |
| **runtime**      | `runtime/`      | `@freeanima/runtime`  | Conversation, turn, loop, pipeline, Engine factory                          |
| **capabilities** | `capabilities/` | `capabilities-*` (8)  | acp, identity, llm-openai, mcp-client, mcp-server, memory, satellite, tools |
| **platform**     | `platform/`     | `@freeanima/platform` | Composition root, ports, connectors, CLI wiring, feature registry           |
| **app**          | `app/`          | `@freeanima/cli`, …   | CLI、desktop/mobile **薄壳**；UI SSOT 为 `app/web/dist`（Hub `/web/*`）     |

### Admin / Console（hub-rest）

| 包名                         | 物理路径                                    | 说明                                                 |
| ---------------------------- | ------------------------------------------- | ---------------------------------------------------- |
| `@freeanima/feature-console` | `features/console/`                         | Console feature（plugin、Admin UI SSOT、build 工具） |
| `@freeanima/admin-api`       | `features/console/hub/admin-api/`           | Admin REST 实现（Elysia）                            |
| `@freeanima/admin-contract`  | `features/console/protocol/admin-contract/` | Admin Hub wire 类型                                  |

Admin UI 源码 SSOT：`features/console/ui/admin/`。Paraglide/build 工具：`features/console/build/`。Shell 路由经 `@freeanima/feature-console/ui/app`。

### Feature 模块（`features/<slug>/`）

内置 plugin 在 [`platform/src/features/builtin-plugins.ts`](../../platform/src/features/builtin-plugins.ts) 注册；Hub RPC 由 `features/*/hub/rpc.ts` 实现，[`platform/src/sap/ws-server.ts`](../../platform/src/sap/ws-server.ts) 经 `getFeatureRpcHandler` 分发（**非** SAP attach）。

典型子目录：`plugin.ts`、`hub/`、`protocol/`（re-export `@freeanima/sap-contract/feature-rpc`）、`ui/`、`domain/`。

chat / task / vault / diary / email / notification / dream / console 等产品面走 **Feature RPC**；`satellites/` 仅保留 companion、pair-programming。

### `@freeanima/core` subpaths

`db`, `db/pg`, `db/schema`, `repos` (types only), `config`, `util`, `tokenizer`, `provider`, `tool`, `llm`, `compress`, `hooks`, `skill`

### `@freeanima/runtime` subpaths

`conversation`, `turn`, `loop`, `goal`, `pipeline`

### `@freeanima/platform` subpaths

`ports`, `config`, `logging`, `commands`, `bootstrap`, `connectors/*`, `sap/*`, `features/*`

### `@freeanima/sap-contract` subpaths（`shared/sap-contract/`）

`.`、`./satellite`、`./feature-rpc`、`./frames/*` — satellite attach 与 feature Hub RPC 分入口。

## Dependency allow/deny matrix

Readable mirror of [`scripts/check-layer-deps.ts`](../../scripts/check-layer-deps.ts). **When rules change, update the script and this section in the same PR.**

Dependency direction (high → low): `app` / `platform` / `features` → `capabilities` → `runtime` → `core` → `kernel`. Lower layers must not import higher layers.

| Source directory                            | Allowed `@freeanima/*` (package root)                                                                                                                 | Explicitly forbidden                                                                                                                                             |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `kernel/`                                   | `kernel`, `kernel-*`                                                                                                                                  | all other workspace packages                                                                                                                                     |
| `core/`                                     | `kernel`, `kernel-*`, `core`                                                                                                                          | `runtime`, `capabilities-*`, `platform`, …                                                                                                                       |
| `runtime/`                                  | `kernel`, `kernel-*`, `core`, `runtime`                                                                                                               | **`platform`**, **`capabilities-*`**                                                                                                                             |
| `capabilities/<pkg>/`                       | `kernel`, `kernel-*`, `core`, **`core/db/pg`**, **`core/db/schema`**, own `capabilities-<pkg>`, `sap-contract`                                        | **`runtime`**, **`platform`**, **other `capabilities-*`**, **`feature-*`**                                                                                       |
| `platform/`, `app/`, `tests/`               | all workspace packages                                                                                                                                | —                                                                                                                                                                |
| `features/console/hub/admin-api/`           | same as `platform/`（nested workspace package）                                                                                                       | —                                                                                                                                                                |
| `features/console/protocol/admin-contract/` | `kernel`, `kernel-*`（devDeps：`platform`, `core`, `admin-api` 仅类型解析）                                                                           | **`platform`**, **`core`**, **`admin-api`**                                                                                                                      |
| `features/<slug>/`                          | `core`, `platform` (hub connectors), `admin-*` (console only), `sap-contract`, `shell-sdk`, `ui-kit`, `vault-crypto`, `capabilities-memory` (interim) | other `feature-*`, `runtime`, arbitrary `capabilities-*`                                                                                                         |
| `satellites/<name>/`                        | `sap-contract`, `shell-sdk`, `ui-kit`, `vault-crypto`, `kernel`, `kernel-*`, matching `feature-*` shim                                                | **`shell-ui`**, **`admin-*`**, **`platform`**, **`core`**, **`runtime`**, **`capabilities-*`** — **only `companion` and `pair-programming` directories allowed** |
| `shared/hub-rpc/`                           | `kernel`, `kernel-*`, `hub-rpc`                                                                                                                       | all other workspace packages                                                                                                                                     |
| `shared/sap-contract/`                      | `kernel`, `kernel-*`, `sap-contract`, `hub-rpc`                                                                                                       | all other workspace packages                                                                                                                                     |
| `shared/vault-crypto/`                      | `kernel`, `kernel-*`, `vault-crypto`                                                                                                                  | all other workspace packages                                                                                                                                     |
| `frontend/ui-kit/`                          | `kernel`, `kernel-*`                                                                                                                                  | **`sap-contract`**, other workspace packages                                                                                                                     |
| `frontend/shell-sdk/`                       | `kernel`, `kernel-*`, `hub-rpc`, `vault-crypto`                                                                                                       | **`sap-contract`**, other workspace packages                                                                                                                     |
| `frontend/shell-ui/`                        | `ui-kit`, `shell-sdk`, `feature-*`, `satellite-*`, `kernel`, `kernel-*`                                                                               | **`sap-contract`**；禁止深路径 import `satellites/`、`platform/admin-frontend/app/`（用 `@freeanima/feature-*/ui/*`）                                            |

Notes aligned with the checker:

- **Scan scope**: `@freeanima/*` imports in `*.ts` / `*.tsx` **and** `dependencies` in each layer's `package.json`.
- **Exemptions** (import scan only): paths under `tests/` or `test-helpers/`, `*.test.ts` / `*.spec.ts`, all `app/cli/` source files, and build path helpers (`features/console/build/*.ts`, selected `frontend/shell-ui/vite/*.ts`). Production code in other layers is still checked.
- **Capabilities isolation**: `capabilities/<src>` must not depend on `@freeanima/capabilities-<other>` where `<other> ≠ <src>`，亦不可依赖任何 `feature-*`。产品域 SSOT 在 `features/*/domain/`；**platform / admin-api / tests** 直接 import `@freeanima/feature-*/domain`。
- **Features isolation**: `features/<slug>` must not depend on other `@freeanima/feature-*`.
- **Platform ↔ feature**: `@freeanima/feature-*` 在 `@freeanima/platform` 的 **`dependencies`** 中声明（register-tools、connectors、plugin 注册）。
- **Satellites**: only **`companion`** and **`pair-programming`** under `satellites/`; product UIs live in `features/*/ui`. Do not import `platform`, `runtime`, `core`, or arbitrary `capabilities-*` — use [`shared/sap-contract`](../../shared/sap-contract/) + [`frontend/shell-sdk`](../../frontend/shell-sdk/) + [`frontend/ui-kit`](../../frontend/ui-kit/)。功能原型见 [`frontend-features.md`](frontend-features.md)。
- **Tests**: production layers may use `@freeanima/platform` test helpers in test files / devDependencies; the checker skips exempt paths above.

## Port wiring at composition root

Boot phases: [`platform/src/boot/`](../../platform/src/boot/). Entry: [`platform/src/serve.ts`](../../platform/src/serve.ts).

- `registerCapabilityInjection()` wires vault helpers from `@freeanima/platform/config` into `@freeanima/core/config`
- `registerFeatures()` wires builtin `FeaturePlugin` list（Hub RPC handlers）
- **runtime / core / capabilities** must not depend on `@freeanima/platform` in production code (tests may use platform test helpers as devDependency)
- Connectors and Admin import `@freeanima/platform/ports` only — not the full boot graph

## RuntimeContext

Single process-wide context after boot (`initRuntimeContext` in [`platform/src/runtime/runtime-context.ts`](../../platform/src/runtime/runtime-context.ts)):

- `deps: FullRuntimeDeps`
- `app: AppRuntimePort`

## Runtime Catalog (Registry instances)

**Forbidden**: module-level registry singletons; direct PG connections inside runtime / capabilities (use `@freeanima/core/db/pg/*` functions instead of `engine.repos`).

**Allowed**: `runWithToolContext` — `@freeanima/core/tool`（经 `@freeanima/runtime/loop` re-export）

**Capabilities 访问 PG**：entity 等域直接 import `@freeanima/core/db/pg/{domain}`（如 task/email 的 `listEntities`）；单测用 `mock.module("@freeanima/core/db/pg/…")`（见 [`testing.md`](testing.md)）。需 runtime 注入 engine 函数时用共享 factory（如 `createEnginePort`），勿复制 `*-port.ts` 文件。
