# Code layers and dependencies

> **Repository** layering (distinct from cognitive Consciousness/Self/Memory/Estate in [`docs/concepts/architecture.md`](../../docs/concepts/architecture.md)). Enforced by [`scripts/check-layer-deps.ts`](../../scripts/check-layer-deps.ts).

## Eight-layer model

| Layer             | Responsibility                                                                                         | Typical packages                                                                             |
| ----------------- | ------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| **kernel**        | Business-agnostic runtime infra: Hook, EventBus, logging, qualified tokens                             | `kernel-hooks`, `kernel-eventbus`, `kernel-logging`, `kernel-token`                          |
| **storage**       | PG schema SSOT, repo ports, Config types, util, tokenizer, LLM provider protocol                       | `storage-db`, `storage-repos`, `storage-config`, `storage-util`, …                           |
| **mechanism**     | Tool registry, LLM client, compression, hooks, skills, session port                                    | `mechanism-tool`, `mechanism-llm`, `mechanism-hooks`, `mechanism-compress`, …                |
| **orchestration** | Session, turn, conversation, loop, runtime facade                                                      | `orchestration-session`, `orchestration-turn`, `orchestration-loop`, `orchestration-runtime` |
| **capabilities**  | Pluggable capability packs (identity, memory, tools, MCP/ACP, estate, …); no composition or I/O wiring | `capabilities-identity`, `capabilities-memory`, `capabilities-tools`, …                      |
| **connectors**    | External-world adapters: Gateway, WebUI, Cron, PG impl, email I/O                                      | `connectors-db-pg`, `connectors-gateway`, `connectors-email`, …                              |
| **service**       | Composition root: Kernel/Engine/Conversation/AnimaService, context injection, process entry            | `service`, `service-bootstrap`, `service-config`, `service-commands`                         |
| **entry**         | CLI (documented; same dep rules as service for imports)                                                | `cli`                                                                                        |

Dependency direction:

```
entry/service → connectors → capabilities → orchestration → mechanism → storage → kernel
```

## Orchestration internal tiers

Under `orchestration/`; enforced by `check-layer-deps.ts`:

| Package                      | Allowed orchestration deps                          |
| ---------------------------- | --------------------------------------------------- |
| `orchestration-turn`         | `orchestration-session`                             |
| `orchestration-conversation` | `orchestration-session`, `orchestration-turn`       |
| `orchestration-runtime`      | session, turn, conversation, loop                   |
| **Forbidden**                | `orchestration-loop` → `orchestration-conversation` |

## Port wiring at composition root

[`wire-engine-ports.ts`](../../service/service/src/wire-engine-ports.ts) (`wireEnginePorts()`); [`wire-capability-injection.ts`](../../service/service/src/wire-capability-injection.ts) (`wireCapabilityInjection()`).

After `FileConfig.open()` + `createServiceLogger()`:

- `createEngine({ config, logger, ... })` injects shared `Config` and logging
- `registerCapabilityInjection({ listCredentials, credential, readAppVersion })` wires service-config helpers for capabilities
- **orchestration / mechanism / storage must not** depend on `service-config` / `service-logging` (use `@freeanima/storage-config` `Config` type and `logCapability` only)
- **capabilities must not** depend on `service-config` / `service-logging` in production code (tests may use `service-config` as devDependency)

## Runtime infra satellite packages

| Package                      | Role                                                                                    | Who may import                                                               |
| ---------------------------- | --------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `@freeanima/storage-config`  | `AnimaConfig` Zod, `Config` container, `logCapability`, capability injection ports      | storage / mechanism / orchestration / capabilities (types + injected config) |
| `@freeanima/service-config`  | `FileConfig extends Config`: `open()` / `reload()` / YAML/credential file I/O           | composition root / connectors / CLI only                                     |
| `@freeanima/service-logging` | Process bootstrap: `createServiceLogger`, `installErrorLogHandlers`, `markStartupPhase` | composition root / CLI startup only                                          |

## Allowed dependencies (matches dep-check)

| Layer             | Allowed `@freeanima/*`                                                                                   | Forbidden (highlights)                                                              |
| ----------------- | -------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| **kernel**        | `kernel-*`, `kernel`                                                                                     | all upper layers                                                                    |
| **storage**       | `kernel-*`, `storage-*`                                                                                  | mechanism+, service, connectors, capabilities                                       |
| **mechanism**     | `kernel-*`, `storage-*`, `mechanism-*`, `capabilities-provider-*`                                        | orchestration+, service, connectors, capabilities (except provider)                 |
| **orchestration** | lower + `orchestration-*` (internal DAG)                                                                 | service, capabilities, connectors                                                   |
| **capabilities**  | `kernel-*`, `storage-*`, `mechanism-*`, `capabilities-*` (**no cross-package deps**), `connectors-redis` | orchestration+, service, connectors (except redis); **capabilities ↔ capabilities** |
| **connectors**    | lower + `service-{api,config,logging}`                                                                   | `@freeanima/service`                                                                |
| **service**       | all layers (composition root)                                                                            | —                                                                                   |

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
- `ServiceContext.masks`: `MaskRegistry` (capabilities; orchestration must not import `capabilities-mask`)

**Forbidden**:

- `export const default*Registry` and module-level `registerTool()` / `listTools()` / `registerMask()` bound on import
- capabilities / orchestration importing `{ defaultToolRegistry }` etc.
- `ToolDef.toolset` field; MCP/ACP dynamic sets use `registerToolSet` / `unregisterToolSet` in pairs (not upsert)
- `bindKernel` / `getKernel` / `Kernel.repos` inner globals
- Direct `new` PG connections or `import connectors-db-pg` inside orchestration / capabilities

**Allowed**:

- `ConversationService` at composition root; runtime via `getServiceContext().conversation` or explicit params
- `SessionStorePort` via `registerMemoryPipeline({ sessionStore })`
- Tool context: `runWithToolContext(sessionId, fn, { repos, tools })` + `getToolRepos()` / `getToolRegistry()` — [`orchestration/loop/src/tool-context.ts`](../../orchestration/loop/src/tool-context.ts)
