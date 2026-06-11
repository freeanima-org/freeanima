# Code layers and dependencies

> **Repository** layering (distinct from cognitive Consciousness/Self/Memory/Estate in [`docs/concepts/architecture.md`](../../docs/concepts/architecture.md)). Enforced by [`scripts/check-layer-deps.ts`](../../scripts/check-layer-deps.ts).

## Layer rationale

| Layer            | Responsibility                                                                                                                    | Typical packages                                                    |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| **kernel**       | Business-agnostic runtime infra: Hook, EventBus, logging, qualified tokens                                                        | `kernel-hooks`, `kernel-eventbus`, `kernel-logging`, `kernel-token` |
| **engine**       | Agent mechanism: conversation, LLM loop, tool registry, compression, repo ports, PG schema SSOT, shared utils, domain hook tokens | see engine tiers below; aggregate `@freeanima/engine`               |
| **life**         | Digital-life continuity and memory pipeline; reads conversation archive via ports only                                            | `life-memory`, `life-self`                                          |
| **capabilities** | Pluggable capability packs (local tools, MCP/ACP, clarify, LLM provider); no composition or I/O wiring                            | `capabilities-tools`, `capabilities-mcp`                            |
| **connectors**   | External-world adapters: Gateway, WebUI, Cron, PG impl, command registration                                                      | `connectors-db-pg`, `connectors-gateway`                            |
| **service**      | Composition root: Kernel/Engine/Conversation/AnimaService, context injection, process entry                                       | `service`, `service-bootstrap`                                      |

Dependency direction: `service` wires layers → `connectors` implement ports → `engine` / `life` / `capabilities` consume ports and mechanisms → `kernel` provides infra.

## Engine internal tiers

Single repo layer `engine/`; subdirs align with `enginePkgTier` in dep-check:

| Tier              | Directory               | Packages (`@freeanima/engine-*`)                                              |
| ----------------- | ----------------------- | ----------------------------------------------------------------------------- |
| **foundation**    | `engine/foundation/`    | `db`, `repos`, `util`, `config`, `tokenizer`, `provider-llm`                  |
| **mechanism**     | `engine/mechanism/`     | `tool`, `skill`, `prompt`, `llm`, `compress`, `hooks`, `session-port`         |
| **orchestration** | `engine/orchestration/` | `session`, `turn`, `conversation` (thin facade), `loop`, `engine` (aggregate) |

Engine internal: `orchestration → mechanism → foundation`; orchestration DAG: `engine-turn → engine-session`, `engine-conversation → engine-turn`; **forbid** `engine-loop` → `engine-conversation`.

**External import boundaries**:

| Caller                   | Allowed engine tiers                                                                                                  |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| **life**                 | foundation (incl. `engine-config`) + `engine-tool`                                                                    |
| **capabilities**         | foundation + mechanism (**no** orchestration); session port via `engine-session-port`; tool context via `engine-tool` |
| **service / connectors** | all (prefer `@freeanima/engine` facade)                                                                               |

Port wiring at composition root: [`wire-engine-ports.ts`](../../service/service/src/wire-engine-ports.ts) (`wireEnginePorts()`); after `loadConfig()` + `createServiceLogger()`, `createEngine({ config, logger, ... })` injects runtime config and logging — **engine must not** depend on `service-config` / `service-logging`.

## Runtime infra satellite packages (not composition root)

Under `service/` physically; dep-check allows life/capabilities/connectors; **engine forbidden**:

| Package                      | Role                                                                                    | Lower layers import                                                                                                   |
| ---------------------------- | --------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `@freeanima/engine-config`   | `AnimaConfig` Zod, pure helpers (`getLlmConfig`, `getCompressionConfig`, `PATHS`, etc.) | engine / life / capabilities for types and defaults                                                                   |
| `@freeanima/service-config`  | Thin adapter: `loadConfig()`, YAML/credential, `validateConfigOnStartup`                | service / connectors / callers needing file I/O only                                                                  |
| `@freeanima/service-logging` | Process bootstrap: `createServiceLogger`, `installErrorLogHandlers`, `markStartupPhase` | composition root / CLI startup only; no domain helpers (`logApiError` etc. live in connectors-webui, service/runtime) |

## Allowed dependencies (matches dep-check)

| Layer            | Allowed `@freeanima/*`                                                                                                                | Forbidden (highlights)                                                                   |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| **kernel**       | `kernel-*`, `kernel`                                                                                                                  | `engine-*`, `service`                                                                    |
| **engine**       | `kernel-*`, `engine-*`, `capabilities-provider-*`                                                                                     | `service-config`, `service-logging`, `connectors-db-pg`                                  |
| **life**         | `kernel-*`, `life-*`, `engine-tool`, `engine-repos`, `engine-util`, `engine-db`, `engine-config`, `service-config`, `service-logging` | `engine-loop`, `engine-conversation`, `connectors-db-pg`                                 |
| **capabilities** | `kernel-*`, `engine-{foundation,mechanism}`, `capabilities-*`, `life-memory`, `connectors-redis`, `service-config`, `service-logging` | `engine-conversation`, `engine-loop`, `engine`, `service`, `connectors-*` (except redis) |
| **connectors**   | lower layers + `service-api` / `service-config` / `service-logging`, etc.                                                             | `@freeanima/service`                                                                     |
| **service**      | all layers (composition root)                                                                                                         | —                                                                                        |

## Composition root

[`service/service/src/serve.ts`](../../service/service/src/serve.ts) is the sole entry wiring PG and runtime context — see file for boot sequence.

## Runtime Catalog (Registry instances)

**Instance acquisition**: `ToolSetRegistry` / `SkillRegistry` / `MaskRegistry` — **`new` one or obtain from context** (or explicit params derived from context).

| Scenario                    | Approach                                                                                                                                 |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Composition root `serve.ts` | `new` each Registry → `Engine.catalog` and `ServiceContext.masks`                                                                        |
| Runtime read/write          | `getServiceContext().engine.catalog.*`, `getServiceContext().masks`; per turn `runWithToolContext(..., { tools })` / `getToolRegistry()` |
| Pass down                   | Explicit params OK; **must come from composition-root `new` or context**, not module defaults                                            |
| Unit tests                  | `new ToolSetRegistry()` etc.; no process-wide catalog pollution                                                                          |

**Ownership**:

- `Engine.catalog`: `toolSets`, `skills`; `ToolSetRegistry` embeds `ToolDef[]`; flat API on `toolSets`
- `Engine.tools`: read-only getter → `catalog.toolSets` (legacy)
- `ServiceContext.masks`: `MaskRegistry` (capabilities; engine must not import `capabilities-mask`)

**Forbidden**:

- `export const default*Registry` and module-level `registerTool()` / `listTools()` / `registerMask()` bound on import
- capabilities / life / engine importing `{ defaultToolRegistry }` etc.
- `ToolDef.toolset` field; MCP/ACP dynamic sets use `registerToolSet` / `unregisterToolSet` in pairs (not upsert)
- `bindKernel` / `getKernel` / `Kernel.repos` inner globals
- Direct `new` PG connections or `import connectors-db-pg` inside engine/life

**Allowed**:

- `ConversationService` at composition root; runtime via `getServiceContext().conversation` or explicit params
- `SessionStorePort` via `registerMemoryPipeline({ sessionStore })`
- Tool context: `runWithToolContext(sessionId, fn, { repos, tools })` + `getToolRepos()` / `getToolRegistry()` — [`engine/loop/src/tool-context.ts`](../../engine/loop/src/tool-context.ts)
