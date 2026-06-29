# Code layers and dependencies

> **Repository** layering (distinct from cognitive Consciousness/Self/Memory/Estate in [`docs/concepts/architecture.md`](../../docs/concepts/architecture.md)). Enforced by [`scripts/check-layer-deps.ts`](../../scripts/check-layer-deps.ts).

## Five-layer model

```
app → platform → capabilities → runtime → core → kernel
```

| Layer            | Directory       | Package               | Responsibility                                            |
| ---------------- | --------------- | --------------------- | --------------------------------------------------------- |
| **kernel**       | `kernel/`       | `@freeanima/kernel`   | Hook, EventBus, logging                                   |
| **core**         | `core/`         | `@freeanima/core`     | PG schema, `db/pg` repos, config, tool/LLM/compress/hooks |
| **runtime**      | `runtime/`      | `@freeanima/runtime`  | Session, turn, loop, Engine factory                       |
| **capabilities** | `capabilities/` | `capabilities-*` (8)  | Identity, memory, tools, MCP client/server, ACP, tasks, … |
| **platform**     | `platform/`     | `@freeanima/platform` | Composition root, ports, connectors, CLI wiring           |
| **app**          | `app/`          | `@freeanima/cli`, …   | CLI、desktop/mobile 壳等用户交付入口                      |

Admin Hub REST / SPA：`@freeanima/admin-contract`（wire 契约）、`@freeanima/admin-api`（REST 实现）、`@freeanima/admin-frontend`（`platform/admin-contract/`、`platform/admin-api/`、`platform/admin-frontend/`）。

### `@freeanima/core` subpaths

`db`, `db/pg`, `db/schema`, `repos` (types only), `config`, `util`, `tokenizer`, `provider`, `tool`, `llm`, `compress`, `hooks`, `skill`

### `@freeanima/runtime` subpaths

`session`, `turn`, `loop`, `conversation`

### `@freeanima/platform` subpaths

`ports`, `config`, `logging`, `commands`, `bootstrap`, `connectors/*`, `sap/*`

## Dependency allow/deny matrix

Readable mirror of [`scripts/check-layer-deps.ts`](../../scripts/check-layer-deps.ts). **When rules change, update the script and this section in the same PR.**

Dependency direction (high → low): `app` / `platform` → `capabilities` → `runtime` → `core` → `kernel`. Lower layers must not import higher layers.

| Source directory              | Allowed `@freeanima/*` (package root)                                                                          | Explicitly forbidden                                                             |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `kernel/`                     | `kernel`, `kernel-*`                                                                                           | all other workspace packages                                                     |
| `core/`                       | `kernel`, `kernel-*`, `core`                                                                                   | `runtime`, `capabilities-*`, `platform`, …                                       |
| `runtime/`                    | `kernel`, `kernel-*`, `core`, `runtime`                                                                        | **`platform`**, **`capabilities-*`**                                             |
| `capabilities/<pkg>/`         | `kernel`, `kernel-*`, `core`, **`core/db/pg`**, **`core/db/schema`**, own `capabilities-<pkg>`, `sap-contract` | **`runtime`**, **`platform`**, **other `capabilities-*`**                        |
| `platform/`, `app/`, `tests/` | all workspace packages                                                                                         | —                                                                                |
| `platform/admin-frontend/`    | `admin-contract`, `ui-kit`, `shell-sdk`, `kernel`, `kernel-*`                                                  | **`platform`**, **`core`**, **`runtime`**, **`capabilities-*`**, **`admin-api`**, **`sap-contract`**, **`shell-ui`** |
| `platform/admin-contract/`    | `kernel`, `kernel-*`（devDeps：`platform`, `core`, `admin-api` 仅类型解析）                                    | **`platform`**, **`core`**, **`admin-api`**                                      |
| `platform/admin-api/`         | `admin-contract`, same as `platform/`                                                                          | —                                                                                |
| `satellites/<name>/`          | `sap-contract`, `shell-sdk`, `ui-kit`, `satellite-sdk`（过渡）, `kernel`, `kernel-*`                           | **`shell-ui`**, **`admin-*`**, **`platform`**, **`core`**, **`runtime`**, **`capabilities-*`** |
| `packages/sap-contract/`      | `kernel`, `kernel-*`, `sap-contract`                                                                           | all other workspace packages                                                     |
| `packages/ui-kit/`            | `kernel`, `kernel-*`                                                                                           | **`sap-contract`**, other workspace packages                                     |
| `packages/shell-sdk/`         | `kernel`, `kernel-*`                                                                                           | **`sap-contract`**, other workspace packages                                     |
| `packages/shell-ui/`          | `ui-kit`, `shell-sdk`, `satellite-*`, `admin-frontend`, `kernel`, `kernel-*`                                 | **`sap-contract`**；禁止深路径 import `satellites/`、`platform/admin-frontend/app/` |
| `packages/satellite-sdk/`     | `ui-kit`, `shell-sdk`, `kernel`, `kernel-*`（Deprecated re-export）                                            | other workspace packages                                                         |

Notes aligned with the checker:

- **Scan scope**: `@freeanima/*` imports in `*.ts` / `*.tsx` **and** `dependencies` in each layer's `package.json`.
- **Exemptions** (import scan only): paths under `tests/` or `test-helpers/`, `*.test.ts` / `*.spec.ts`, and all `app/cli/` source files. Production code in other layers is still checked.
- **Capabilities isolation**: `capabilities/<src>` must not depend on `@freeanima/capabilities-<other>` where `<other> ≠ <src>`.
- **Satellites**: do not import `platform`, `runtime`, `core`, or arbitrary `capabilities-*` — use [`sap-contract`](../../packages/sap-contract/) + [`shell-sdk`](../../packages/shell-sdk/) + [`ui-kit`](../../packages/ui-kit/)（`satellite-sdk` 为过渡 re-export）。功能原型见 [`frontend-features.md`](frontend-features.md)。
- **Tests**: production layers may use `@freeanima/platform` test helpers in test files / devDependencies; the checker skips exempt paths above.

## Port wiring at composition root

Boot phases: [`platform/src/boot/`](../../platform/src/boot/). Entry: [`platform/src/serve.ts`](../../platform/src/serve.ts).

- `registerCapabilityInjection()` wires credential helpers from `@freeanima/platform/config` into `@freeanima/core/config`
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
