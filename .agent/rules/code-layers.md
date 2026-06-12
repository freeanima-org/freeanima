# Code layers and dependencies

> **Repository** layering (distinct from cognitive Consciousness/Self/Memory/Estate in [`docs/concepts/architecture.md`](../../docs/concepts/architecture.md)). Enforced by [`scripts/check-layer-deps.ts`](../../scripts/check-layer-deps.ts).

## Five-layer model

```
platform → capabilities → runtime → core → kernel
```

| Layer            | Directory       | Package               | Responsibility                                    |
| ---------------- | --------------- | --------------------- | ------------------------------------------------- |
| **kernel**       | `kernel/`       | `@freeanima/kernel`   | Hook, EventBus, logging                           |
| **core**         | `core/`         | `@freeanima/core`     | PG schema, repos, config, tool/LLM/compress/hooks |
| **runtime**      | `runtime/`      | `@freeanima/runtime`  | Session, turn, loop, Engine factory               |
| **capabilities** | `capabilities/` | `capabilities-*` (7)  | Identity, memory, tools, MCP/ACP, tasks, …        |
| **platform**     | `platform/`     | `@freeanima/platform` | Composition root, ports, connectors, CLI wiring   |
| **entry**        | `cli/`          | `@freeanima/cli`      | `anima` CLI                                       |

### `@freeanima/core` subpaths

`db`, `repos`, `config`, `util`, `tokenizer`, `provider`, `tool`, `llm`, `compress`, `hooks`, `skill`

### `@freeanima/runtime` subpaths

`session`, `turn`, `loop`, `conversation`

### `@freeanima/platform` subpaths

`ports`, `config`, `logging`, `commands`, `bootstrap`, `connectors/*`

## Port wiring at composition root

Boot phases: [`platform/src/boot/`](../../platform/src/boot/). Entry: [`platform/src/serve.ts`](../../platform/src/serve.ts).

- `registerCapabilityInjection()` wires credential helpers from `@freeanima/platform/config` into `@freeanima/core/config`
- **runtime / core / capabilities** must not depend on `@freeanima/platform` in production code (tests may use platform test helpers as devDependency)
- Connectors and WebUI import `@freeanima/platform/ports` only — not the full boot graph

## RuntimeContext

Single process-wide context after boot (`initRuntimeContext` in [`platform/src/runtime/runtime-context.ts`](../../platform/src/runtime/runtime-context.ts)):

- `deps: FullRuntimeDeps`
- `app: AppRuntimePort`

## Runtime Catalog (Registry instances)

**Forbidden**: module-level registry singletons; direct PG connections inside runtime / capabilities.

**Allowed**: `runWithToolContext` — [`runtime/src/loop/tool-context.ts`](../../runtime/src/loop/tool-context.ts)
