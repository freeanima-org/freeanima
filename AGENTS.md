# FreeAnima — Agent Bootstrap Protocol

> For AI agents working in this repository (Cursor, Copilot, etc.).
> Digital-life identity: [`docs/concepts/identity.md`](docs/concepts/identity.md); self layer: [`docs/concepts/self-layer.md`](docs/concepts/self-layer.md).

## Global view

`freeanima` (FreeAnima) is a **TypeScript-only** agent runtime: `anima service` starts the Bun service (WebUI + tRPC + Gateway + engine).

| Capability     | Highlights                                                                                                                                              |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Memory         | Conversation archive (PG) → light-sleep extraction → `semantic_memory` → PG FTS retrieval; see [`docs/concepts/memory.md`](docs/concepts/memory.md)     |
| Tools          | Local / MCP / ACP flat registration; implemented in `capabilities/tools/`, `capabilities/mcp/`, `capabilities/acp/`                                     |
| Credentials    | pass GPG; injected at runtime; LLM **sees paths, not values**                                                                                           |
| Data directory | `~/.anima/` (override with `FREEANIMA_HOME`); back up this directory to preserve state                                                                  |
| Code layout    | `kernel/`, `engine/`, `life/`, `capabilities/`, `connectors/`, `service/`, `cli/`; see [`docs/concepts/architecture.md`](docs/concepts/architecture.md) |

**Code is the source of truth**; do not invent tool names, endpoints, or directories from docs alone. Read source or `grep` when needed.

---

## Startup order

1. [GitHub Issues](https://github.com/freeanima-org/freeanima/issues) — actionable tasks and discussions
2. [`docs/concepts/architecture.md`](docs/concepts/architecture.md) — read before changing architecture / memory / credentials
3. Expand `docs/` topics per task (see doc map below)

---

## Hard constraints

### Code and tests

- Full type annotations
- Tool returns: **failures always use `toolError(msg)` (JSON `{"error":"..."}`)**; successes split into structured tools with `toolResult(obj)`, and LLM-readable tools (e.g. `file_read_file` / `terminal_run` / `code_execute`) may return plain-text stdout.
- Safe paths per code (write protection, device blocking, binary filtering)
- New features need tests (minimal viable); mock external deps; real LLM / network cases excluded from CI by default
- **Relative imports must include `.ts` / `.tsx` suffix** (oxlint `import/extensions`)
- Integration tests must isolate logs: `tests/helpers/integration-case.ts` (`restoreIntegrationHome` + `flushCompressionSummaries`); do not pollute `~/.anima/error.log`

### Release and CHANGELOG

- **Do not manually edit [`CHANGELOG.md`](CHANGELOG.md)**: Release Please writes the new version section at the top when a Release PR merges; agents must not change that file in PRs/tasks (including entries, `[Unreleased]`, bullets, or formatting).
- Release flow and commit conventions: [`docs/guide/versioning.md`](docs/guide/versioning.md);

#### Test tiers (mandatory)

| Tier                          | Location                                                                | Allowed                                                  | Forbidden                                                                               |
| ----------------------------- | ----------------------------------------------------------------------- | -------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| **Unit tests**                | `{layer}/{pkg}/src/**/*.test.ts` (**always colocated**)                 | `mock` / `spyOn` / same-package Tier 1–2 exports (below) | PG, real Redis, file I/O, `FREEANIMA_HOME` isolation, `tests/helpers/`, Docker, network |
| **Cross-package integration** | `tests/integration/`                                                    | PG, Redis, temp dirs, `beginIntegrationCase`             | —                                                                                       |
| **Black-box E2E**             | [freeanima-testing](https://github.com/freeanima-org/freeanima-testing) | Compose + Playwright; PR dispatch async                  | —                                                                                       |

- pre-commit: `bun run test:changed` (**unit only**, changed); before PR push run `bun run test` full (unit + integration; black-box in freeanima-testing).
- Single-package logic → colocated unit tests; multi-package or real persistence → `tests/integration/`.

#### Same-package mock exports (prefer in unit tests)

| Tier                       | Packages                                                                                 | Usage                                                      |
| -------------------------- | ---------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| Tier 1 in-memory adapters  | `kernel-logging/null`, `/memory`; `kernel-eventbus/memory`, `/null`; `engine-repos/null` | `createNullSink`, `MemoryEventQueue`, `nullPgRepositories` |
| Tier 2 singleton injection | `connectors-redis`, `connectors-db-pg`, `service-config`, etc.                           | `setXForTest` / `resetXForTest`; `afterEach` must reset    |
| Tier 3 composite factories | optional `@freeanima/{pkg}/testing`                                                      | Tier 1 only, e.g. `createTestLogger`                       |
| Domain mocks               | `{pkg}/src/test-helpers/`                                                                | when package has no port (e.g. `MockBackend`)              |

Unit tests **must not** `import` `tests/helpers/log-isolation.ts` or write `config.yaml`; use `setConfigForTest` for config and `createNullSink` / `createMemorySink` for logging.

### Package naming (RFC #1)

New-stack workspace package names **prefix with layer name**:

| Shape                | Pattern                            | Example                                         |
| -------------------- | ---------------------------------- | ----------------------------------------------- |
| Layer aggregate      | `@freeanima/{layer}`               | `kernel`, `engine`                              |
| Layer component      | `@freeanima/{layer}-{slug}`        | `kernel-eventbus`, `engine-tool`, `service-api` |
| Layer implementation | `@freeanima/{layer}-{slug}-{impl}` | `connectors-eventbus-sqlite`                    |

- Compound slugs without inner hyphens (`eventbus`, not `event-bus`)
- Hook / EventTopic `qualifiedId` is independent of npm package name

### Code layers and dependencies

> This is **repository** layering (distinct from the cognitive four layers Consciousness/Self/Memory/Estate in [`docs/concepts/architecture.md`](docs/concepts/architecture.md)). Dependency boundaries are enforced by [`scripts/check-layer-deps.ts`](scripts/check-layer-deps.ts).

#### Layer rationale

| Layer            | Responsibility (split criterion)                                                                                                        | Typical packages                                                  |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| **kernel**       | Business-agnostic runtime infra: Hook, EventBus, logging, cross-layer pure types/utils                                                  | `kernel-hooks`, `kernel-eventbus`, `kernel-logging`               |
| **engine**       | Agent **mechanism**: conversation, LLM loop, tool registry, compression, repo ports, PG schema SSOT                                     | `engine-conversation`, `engine-loop`, `engine-repos`, `engine-db` |
| **life**         | Digital-life **continuity and memory pipeline** (semantic/episodic memory, light/deep sleep); reads conversation archive via ports only | `life-memory`, `life-self`                                        |
| **capabilities** | Pluggable **capability packs** (local tools, MCP/ACP, clarify, LLM provider); no composition or I/O wiring                              | `capabilities-tools`, `capabilities-mcp`                          |
| **connectors**   | **External-world adapters**: Gateway, WebUI, Cron, PG impl, command registration                                                        | `connectors-db-pg`, `connectors-gateway`                          |
| **service**      | **Composition root**: creates Kernel/Engine/Conversation/AnimaService, injects context, process entry                                   | `service`, `service-bootstrap`                                    |

Dependency direction: `service` wires layers → `connectors` implement ports → `engine` / `life` / `capabilities` consume ports and mechanisms → `kernel` provides infra.

#### Allowed dependencies (matches dep-check)

| Layer            | Allowed `@freeanima/*`                                                                                                       | Forbidden (highlights)                                          |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| **kernel**       | `kernel-*`, `kernel`                                                                                                         | `engine-*`, `service`                                           |
| **engine**       | `kernel-*`, `engine-*`, `service-config`, `service-logging`, `capabilities-provider-*`                                       | `connectors-db-pg` (PG impl must not leak into mechanism layer) |
| **life**         | `kernel-*`, `life-*`, `engine-tool`, `engine-repos`, `service-config`, `service-logging`                                     | `engine-db`, `connectors-db-pg`                                 |
| **capabilities** | `kernel-*`, `engine-*`, `capabilities-*`, `life-memory` (as needed), `connectors-redis`, `service-config`, `service-logging` | `service`, `connectors-*` (except redis)                        |
| **connectors**   | lower layers + `service-api` / `service-config` / `service-logging`, etc.                                                    | `@freeanima/service` (main composition root package)            |
| **service**      | all layers (composition root)                                                                                                | —                                                               |

#### Composition root and global singletons

[`service/service/src/serve.ts`](service/service/src/serve.ts) is the sole entry that wires PG and runtime context:

```
createServiceKernel()
→ catalog = createEngineCatalog(); masks = new MaskRegistry()
→ registerServiceTools(catalog); initMaskSystem(masks)
→ createEngine({ catalog, repos, llm })
→ createConversationService(engine.repos, catalog.toolSets)
→ new AnimaService({ kernel, conversation })
→ initServiceContext({ engine, masks, service, conversation, ... })
```

#### Runtime Catalog (Registry instances)

**Instance acquisition**: to get `ToolSetRegistry` / `SkillRegistry` / `MaskRegistry` etc., **either `new` one or obtain from context (or explicit params derived from context)**.

| Scenario                                                    | Approach                                                                                                                                     |
| ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Composition root [`serve.ts`](service/service/src/serve.ts) | `new` each Registry; put into `Engine.catalog` and `ServiceContext.masks`                                                                    |
| Runtime read/write                                          | `getServiceContext().engine.catalog.*`, `getServiceContext().masks`; per turn via `runWithToolContext(..., { tools })` / `getToolRegistry()` |
| Pass down                                                   | Explicit params (e.g. `registerCoreTools(toolSets)`) OK; **params must come from composition-root `new` or context**, not module defaults    |
| Unit tests                                                  | `new ToolSetRegistry()` etc. isolated instances; no process-wide catalog pollution                                                           |

**Ownership** (layer boundaries):

- `Engine.catalog`: `toolSets`, `skills` (engine layer); `ToolSetRegistry` embeds `ToolDef[]`; flat API (`getTool` / `listTools` / `openaiSchemas`) on `toolSets` instance
- `Engine.tools`: read-only getter pointing at `catalog.toolSets` (legacy callers)
- `ServiceContext.masks`: `MaskRegistry` (capabilities layer; engine must not import `capabilities-mask`)

**Forbidden**:

- `export const default*Registry` and module-level `registerTool()` / `listTools()` / `registerMask()` that depend on it (implicit bind on import, not injectable)
- capabilities / life / engine importing `{ defaultToolRegistry }` etc.
- `ToolDef.toolset` field; tool ownership is by ToolSet; MCP/ACP dynamic sets use `registerToolSet` / `unregisterToolSet` in pairs (not upsert)

**Allowed**: same as `ConversationService`, `SessionStorePort` — instantiated at composition root; runtime via `getServiceContext()` or explicit params.

**Forbidden:**

- `bindKernel` / `getKernel` / `Kernel.repos` etc. inner global singletons
- Direct `new` PG connections or `import connectors-db-pg` inside engine/life

**Allowed:**

- **`ConversationService`**: instantiated at service composition root; runtime via `getServiceContext().conversation` or **explicit params**
- **`SessionStorePort`**: life memory pipeline via `registerMemoryPipeline({ sessionStore })`
- **Tool context**: `runWithToolContext(sessionId, fn, { repos, tools })` + `getToolRepos()` / `getToolRegistry()` (see `engine/loop/src/tool-context.ts`)

### Type ownership

When adding or moving types / Zod / ports, decide in this order:

1. **PG storage shape (DDL + JSONB Zod)** → `@freeanima/engine-db` (sole SSOT)
2. **Repository ports and aggregates** → `@freeanima/engine-repos` (`*StorePort`, `PgRepositories`; includes `null*` adapters)
3. **Domain types** → **owner consumes** (in that layer's `{layer}-{slug}` package); hoist to kernel pure-type packages only when shared across domains

Additional rules:

- Domain views may `import type` / `z.infer` from `engine-db`, but **must not duplicate** storage Zod definitions
- **HTTP/WebUI contracts** in `connectors-webui/api` or `service-api`; **in-process snapshots/display** in service
- **EventBus payloads** belong to the **publisher's domain** (memory events → life-memory)

#### Type ownership table

| Content                                                                          | Package                      | Path / notes                                              |
| -------------------------------------------------------------------------------- | ---------------------------- | --------------------------------------------------------- |
| Slice A message / session_meta storage Zod                                       | `engine-db/schema`           | JSONB and payload SSOT                                    |
| Slice A domain convenience types (`SessionMessage`, `ConversationMessage`, etc.) | `engine-db/domain`           | Derived from schema; `engine-conversation` re-exports     |
| `SessionStorePort` / `PgRepositories`                                            | `engine-repos`               | Repository ports                                          |
| Light-sleep fact extraction schema                                               | `life-memory/schemas`        | `fact-extraction.ts`, `fact.ts`                           |
| EventBus payload Zod (`session:updated`, etc.)                                   | `life-memory/schemas`        | `event-payloads.ts`; topic token in `events.ts`           |
| `cron_jobs` PG schema (DDL)                                                      | `engine-db/migrations`       | SQL migration                                             |
| Cron job API validation schema                                                   | `connectors-cron`            | `schema.ts`                                               |
| `CronJobStorePort`                                                               | `engine-repos`               | `ports/cron.ts`                                           |
| `tasks` DDL + status/priority Zod                                                | `engine-db/schema`           | `tasks.ts`                                                |
| `TaskStorePort` / `TaskRow`                                                      | `engine-repos`               | `ports/task.ts`                                           |
| Task tools + fridge summary bridge                                               | `capabilities-tasks`         | `tool.ts`, `fridge-bridge.ts`                             |
| `self_blocks` DDL + `selfBlockKeySchema`                                         | `engine-db/schema`           | `self-layer.ts`                                           |
| `SelfLayerStorePort` / `SelfBlockRow`                                            | `engine-repos`               | `ports/self-layer.ts`                                     |
| Six-block prompt view (`SELF_BLOCK_HEADINGS`, etc.)                              | `life-self`                  | `blocks.ts`, `compose.ts`                                 |
| `autobiographical_memory` DDL + significance/status Zod                          | `engine-db/schema`           | `autobiographical-memory.ts`                              |
| `AutobiographicalMemoryStorePort`                                                | `engine-repos`               | `ports/autobiographical-memory.ts`                        |
| Autobiography cron orchestration / tools                                         | `life-memory`                | `autobiography/`, `autobiographical-tools.ts`             |
| `limbic_memory` DDL + `limbicKindSchema`                                         | `engine-db/schema`           | `limbic-memory.ts`                                        |
| `LimbicMemoryStorePort`                                                          | `engine-repos`               | `ports/limbic-memory.ts`                                  |
| Light-sleep Stage 2 limbic / Stage 3 autobiography / `memory_limbic_create`      | `life-memory`                | `limbic-tools.ts`, `light-sleep/run.ts`, `autobiography/` |
| Capability masks (`Mask` / `ResolvedMask` / registry)                            | `capabilities-mask`          | `types.ts`, `registry.ts`, `resolve.ts`                   |
| Session `capability_mask` storage shape                                          | `engine-db/schema`           | `jsonb/capability-mask.ts`                                |
| WebUI display view (`MessagesDisplay`)                                           | `service/schemas`            | `display.ts`                                              |
| AnimaService internal snapshot (`ServiceSnapshot`, etc.)                         | `service/schemas`            | `snapshot.ts`                                             |
| WeChat gateway persistence schema                                                | `connectors-gateway/schemas` | `weixin.ts`                                               |
| JSON safeParse utilities                                                         | `kernel-util`                | `parseJsonFile`, `safeParseOrNull`, etc.                  |

New PG domain: `engine-db/schema/{domain}` → add port in `engine-repos` → implement in `connectors-db-pg` → extend `PgRepositories` → wire in `serve.ts`. See [`docs/guide/database.md`](docs/guide/database.md).

#### PG schema migrations (mandatory)

**Flow**: change `engine/db/src/schema/` → **`drizzle-kit generate`** → **`migrate`**.

| Step | Command / action                                                   | Output                                                               |
| ---- | ------------------------------------------------------------------ | -------------------------------------------------------------------- |
| 1    | Change Drizzle schema (`engine/db/src/schema/`)                    | TypeScript SSOT                                                      |
| 2    | `DATABASE_URL=… bun run --filter @freeanima/engine-db db:generate` | `migrations/{ts}_{name}/migration.sql` + **`snapshot.json`**         |
| 3    | `DATABASE_URL=… bun run --filter @freeanima/engine-db db:migrate`  | PG applies DDL; production may auto-migrate on `anima service` start |

**Forbidden**:

- **Skip `generate` and hand-write `migration.sql` only** (missing `snapshot.json` breaks Drizzle snapshot chain; next `generate` may recreate tables)
- **Edit SQL / delete snapshot in already-applied migration dirs** (add a new migration to fix)

**Allowed**: after `generate`, **append** SQL Drizzle cannot express in that migration's `migration.sql` (e.g. `CREATE EXTENSION`, `message_fts_input()`, some GIN expression indexes); **do not** use this to replace the whole generate step.

### Security and continuity

- Credentials and secrets never in git / logs / tool return values
- Memory and self-layer changes need extra care (see [`docs/concepts/identity.md`](docs/concepts/identity.md))
- Continuity over feature pile-up; simple infra written in-house, complex logic via mature third-party libs

---

## Common commands

```bash
bun install && bun run check # before PR: typecheck + lint + format + tests
bun run test:changed # local / pre-commit (unit changed only)
bun run test:unit # all unit tests
bun run test:integration # integration (tests/integration/)
bun run test # unit + integration in parallel
bun run service start --foreground # foreground block (logs to stdout)
bun run service start --dev # WebUI source watch rebuild (not HMR; refresh page after frontend edits)
anima credential list # credential paths; values in pass

# PG schema changes (must generate snapshot.json; see "PG schema migrations" above)
DATABASE_URL="…" bun run --filter @freeanima/engine-db db:generate
DATABASE_URL="…" bun run --filter @freeanima/engine-db db:migrate
```

- WebUI parlor: `http://127.0.0.1:2658/webui/parlor/chat`
- Release and commit conventions: [`docs/guide/versioning.md`](docs/guide/versioning.md)
- PG migrations: [`docs/guide/database.md`](docs/guide/database.md)

---

## Doc map

| File                                                               | Role                                                |
| ------------------------------------------------------------------ | --------------------------------------------------- |
| [`AGENTS.md`](AGENTS.md)                                           | This file: bootstrap protocol and hard constraints  |
| [GitHub Issues](https://github.com/freeanima-org/freeanima/issues) | Actionable tasks and discussions                    |
| [`docs/concepts/architecture.md`](docs/concepts/architecture.md)   | Architecture principles and direction               |
| [`docs/concepts/`](docs/concepts/)                                 | Core concepts (memory, self layer, etc.)            |
| [`docs/guide/`](docs/guide/)                                       | Usage and maintenance (security, database, release) |
| [`docs/features/`](docs/features/)                                 | Major product capabilities                          |
| [`docs/tools/`](docs/tools/)                                       | General/minor built-in tools                        |

---

## Conflict priority

1. **Code implementation** > all docs
2. **`docs/concepts/architecture.md`** > other `docs/**/*.md`
3. **GitHub Issues** > architecture direction planning

## Docs to update when code changes

| Change type                                    | Update                                                                                                               |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Slice A / PG schema                            | [`docs/guide/database.md`](docs/guide/database.md)                                                                   |
| Layer deps / composition root / type ownership | This file (code layers & deps, type ownership) + [`docs/guide/database.md`](docs/guide/database.md) PG package table |
| Memory pipeline / retrieval                    | [`docs/concepts/memory.md`](docs/concepts/memory.md) + architecture                                                  |
| Security / threat surface                      | [`docs/guide/security.md`](docs/guide/security.md) + architecture                                                    |
| Architecture principles                        | [`docs/concepts/architecture.md`](docs/concepts/architecture.md)                                                     |
| New RFC package / rename                       | This file naming table + architecture code-layer section                                                             |
| Release                                        | [`docs/guide/versioning.md`](docs/guide/versioning.md)                                                               |
| Task done                                      | close corresponding GitHub Issue; user-visible changes use Conventional Commits                                      |

Tool tables, module trees, API lists **are not maintained in docs** — use registration code and service router as source of truth.

## Maintenance conventions

- Principle changes first in [`docs/concepts/architecture.md`](docs/concepts/architecture.md), then decide on a topic doc
- New topic >50 lines and long-lived → `docs/`; actionable items → GitHub Issue
- Close Issue when task done; do not keep completed items in docs
- **docs layout**: deploy/credentials/release → `docs/guide/`; mechanisms → `docs/concepts/`; major product features → `docs/features/`; general tools → `docs/tools/`; unimplemented ideas → Issue, not doc

## What each file must not contain

| File                          | Forbidden                                                                                                                   |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| AGENTS.md (this file)         | Full tool table, directory tree, API cross-ref, SemVer details (**must** maintain code layers & deps, type ownership table) |
| docs/concepts/architecture.md | Concrete todos, weekly-changing tool lists                                                                                  |
| CHANGELOG.md                  | Manual add/remove of version sections or entries (Release Please maintains; see "Release and CHANGELOG" above)              |
