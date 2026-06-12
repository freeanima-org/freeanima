# Code layers and dependencies

> **Repository** layering (distinct from cognitive Consciousness/Self/Memory/Estate in [`docs/concepts/architecture.md`](../../docs/concepts/architecture.md)). Enforced by [`scripts/check-layer-deps.ts`](../../scripts/check-layer-deps.ts).

## Target: five-layer model

Migration from the historical eight-layer layout is in progress. **Target** dependency direction:

```
platform → capabilities → runtime → core → kernel
```

| Layer            | Responsibility                                                             | Target package(s)                                       |
| ---------------- | -------------------------------------------------------------------------- | ------------------------------------------------------- |
| **kernel**       | Business-agnostic runtime infra: Hook, EventBus, logging, qualified tokens | `@freeanima/kernel`                                     |
| **core**         | PG schema, repos, Config, tool registry, LLM, compression, hooks, skills   | `@freeanima/core`（subpath：`/db`、`/tool`、`/llm` 等） |
| **runtime**      | Session, turn, conversation, LLM↔tool loop, Engine factory                 | `@freeanima/runtime`                                    |
| **capabilities** | Pluggable capability packs (identity, memory, tools, MCP/ACP, …)           | `capabilities-*`（组内可依赖，禁止环）                  |
| **platform**     | Composition root, Gateway, WebUI, Cron, PG/Redis impl, CLI                 | `@freeanima/platform` + `@freeanima/platform/ports`     |

### Migration map (v3.1 → target)

| Historical layer / prefix          | Target                        |
| ---------------------------------- | ----------------------------- |
| `storage-*`, `mechanism-*`         | `@freeanima/core` subpaths    |
| `orchestration-*`                  | `@freeanima/runtime`          |
| `service-*`, `connectors-*`, `cli` | `@freeanima/platform`         |
| `capabilities-*`                   | merged fewer `capabilities-*` |

Until migration completes, `scripts/check-layer-deps.ts` may still reference legacy directory names (`storage/`, `orchestration/`, etc.).

## Port wiring at composition root

Boot phases live under [`service/service/src/boot/`](../../service/service/src/boot/) (moving to `platform/boot/`). Entry: [`serve.ts`](../../service/service/src/serve.ts).

After `FileConfig.open()` + `createServiceLogger()`:

- `createEngine({ config, logger, ... })` injects shared `Config` and logging
- `registerCapabilityInjection({ listCredentials, credential, readAppVersion })` wires service-config helpers for capabilities
- **runtime / core must not** depend on `service-config` / `service-logging` (use `@freeanima/storage-config` `Config` type and `logCapability` only)
- **capabilities must not** depend on `service-config` / `service-logging` in production code (tests may use `service-config` as devDependency)

## Runtime infra satellite packages (transitional)

| Package                      | Role                                                                                    | Who may import                                          |
| ---------------------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| `@freeanima/storage-config`  | `AnimaConfig` Zod, `Config` container, `logCapability`, capability injection ports      | core / runtime / capabilities (types + injected config) |
| `@freeanima/service-config`  | `FileConfig extends Config`: `open()` / `reload()` / YAML/credential file I/O           | composition root / connectors / CLI only                |
| `@freeanima/service-logging` | Process bootstrap: `createServiceLogger`, `installErrorLogHandlers`, `markStartupPhase` | composition root / CLI startup only                     |

## RuntimeContext (composition root)

Single process-wide context after boot (`initRuntimeContext`):

- `deps: FullRuntimeDeps` — engine, conversation, masks, MCP/ACP
- `app: AppRuntimePort` — HTTP/Gateway-facing API

Consumers in connectors/commands import `@freeanima/service-api` (→ future `@freeanima/platform/ports`) — **not** `@freeanima/service` implementation.

## Runtime Catalog (Registry instances)

**Instance acquisition**: `ToolSetRegistry` / `SkillRegistry` / `MaskRegistry` — **`new` one or obtain from context**.

| Scenario                    | Approach                                                                                                         |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Composition root `serve.ts` | `new` each Registry → `Engine.catalog` and runtime context `masks`                                               |
| Runtime read/write          | `getRuntimeContext().deps.engine.catalog.*`; per turn `runWithToolContext(..., { tools })` / `getToolRegistry()` |
| Pass down                   | Explicit params OK; **must come from composition-root `new` or context**, not module defaults                    |
| Unit tests                  | `new ToolSetRegistry()` etc.; no process-wide catalog pollution                                                  |

**Forbidden**:

- `export const default*Registry` and module-level `registerTool()` bound on import
- capabilities / runtime importing module-level registry singletons
- `bindKernel` / `getKernel` / `Kernel.repos` inner globals
- Direct `new` PG connections or `import connectors-db-pg` inside runtime / capabilities

**Allowed**:

- `ConversationService` at composition root; runtime via context or explicit params
- Tool context: `runWithToolContext(sessionId, fn, { repos, tools })` — [`orchestration/loop/src/tool-context.ts`](../../orchestration/loop/src/tool-context.ts) (→ `@freeanima/runtime/loop`)

## Historical package rename (v3.1)

| Old prefix                       | New prefix                                      |
| -------------------------------- | ----------------------------------------------- |
| `engine-db` etc. foundation      | `storage-*`                                     |
| `engine-tool` etc. mechanism     | `mechanism-*`                                   |
| `engine-loop` etc. orchestration | `orchestration-*` → **`runtime`** (target)      |
| `life-self` / `life-memory`      | `capabilities-identity` / `capabilities-memory` |
| `connectors-commands`            | `service-commands`                              |
