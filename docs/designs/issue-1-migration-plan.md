---
title: Issue 1 Migration Plan
---

## Migration Plan Supplement (2026-06-02)

> **Archived / historical record** — RFC #1 migration completed 2026-06-05; steps 0–11 below for reference, not current operational guide.
> Responds to Issue discussion #4 (migration strategy), with current-state assessment conclusions.

### Strategy: Parallel New Packages + Bottom-Up Per-Package Migration (Strangler Fig)

No incremental refactor inside old directories; **flatten directories by RFC layer at repo root**, migrate **package by package starting from kernel**. **Migration completed 2026-06-05** (`packages/`, `apps/` removed).

**Confirmed decisions:**

- **Directory layout:** Flat at root — `kernel/`, `engine/`, `life/`, `capabilities/`, `connectors/`, `service/`, `cli/`
- **Package naming:** `@freeanima/{layer}-{slug}` (see [`AGENTS.md`](../../AGENTS.md))

### New Stack Package Naming (2026-06-04)

Single source of truth for naming: [`AGENTS.md`](../../AGENTS.md#新栈包命名rfc-1).

| Form                    | Pattern                            | Examples                                                     |
| ----------------------- | ---------------------------------- | ------------------------------------------------------------ |
| Layer aggregate         | `@freeanima/{layer}`               | `kernel`, `engine`, `service`                                |
| In-layer component      | `@freeanima/{layer}-{slug}`        | `kernel-eventbus`, `engine-tool`, `life-memory`              |
| In-layer implementation | `@freeanima/{layer}-{slug}-{impl}` | `connectors-eventbus-sqlite`, `capabilities-provider-openai` |

Slug compound words without internal hyphen (`eventbus` not `event-bus`).

### Target Directory Structure

```
freeanima/
├── kernel/
│   ├── eventbus/              # @freeanima/kernel-eventbus
│   ├── hooks/                 # @freeanima/kernel-hooks
│   ├── logging/               # @freeanima/kernel-logging
│   └── kernel/                # @freeanima/kernel (aggregate)
├── engine/                    # @freeanima/engine (aggregate); subpackages engine-tool, engine-provider, etc.
├── life/
│   ├── memory/                # @freeanima/life-memory
│   ├── self/                  # @freeanima/life-self
│   └── estate/                # @freeanima/life-estate
├── capabilities/
│   ├── tools/                 # @freeanima/capabilities-tools
│   ├── provider/              # @freeanima/capabilities-provider (or capabilities-provider-openai)
│   ├── mcp/                   # @freeanima/capabilities-mcp
│   ├── acp/                   # @freeanima/capabilities-acp
│   └── clarify/               # @freeanima/capabilities-clarify
├── connectors/
│   ├── eventbus-sqlite/       # @freeanima/connectors-eventbus-sqlite
│   ├── gateway/               # @freeanima/connectors-gateway
│   ├── webui/                 # @freeanima/connectors-webui (HTTP server + Vue SPA)
│   ├── cron/                  # @freeanima/connectors-cron
│   └── commands/              # @freeanima/connectors-commands
├── service/                   # @freeanima/service (AnimaService + serve)
├── cli/                       # @freeanima/cli
└── tests/                     # @freeanima/integration-tests
```

### workspace (bun)

```yaml
packages:
  - "kernel/*"
  - "engine/*"
  - "life/*"
  - "capabilities/*"
  - "connectors/*"
  - "service/*"
  - "cli"
  - "tests"
```

### Migration Steps

| Step | Package         | Status                   |
| ---- | --------------- | ------------------------ |
| 0–11 | See table below | ✅ Complete (2026-06-05) |

| Step | Package                  | Completion criteria                                                 |
| ---- | ------------------------ | ------------------------------------------------------------------- |
| 0    | legacy rename            | Full repo imports to legacy; legacy shells later removed            |
| 1    | `kernel/`                | hooks / eventbus / schemas / db                                     |
| 2    | `capabilities/provider/` | LLM Provider implementations                                        |
| 3    | `engine/`                | Main loop + tool loop; engine calls `@freeanima/engine-db` directly |
| 4    | `life/memory/`           | Memory pipeline, skills, retrieval                                  |
| 5    | `life/self/`             | Shell (`@freeanima/life-self`)                                      |
| 6    | `life/estate/`           | Shell (`@freeanima/life-estate`)                                    |
| 7    | `capabilities/*`         | tools / mcp / acp / clarify                                         |
| 8    | `connectors/*`           | gateway / cron / commands / webui                                   |
| 9    | `service/`               | `serve` + `AnimaService` assembles full stack                       |
| 10   | `cli/`                   | `anima` bin → `@freeanima/service`                                  |
| 11   | Remove legacy            | Remove `packages/`, `apps/`                                         |

Production entry: `anima service` → [`service/service/src/serve.ts`](../../service/service/src/serve.ts).

### Cross-Cutting Modules

| Module                                   | Transition                                                     | Final home                                |
| ---------------------------------------- | -------------------------------------------------------------- | ----------------------------------------- |
| `@freeanima/engine-db`                   | **Migrated** to `engine/db`; shared by life/memory and service | Long-term persistence; types in engine-db |
| EventBus/registry/config implementations | New kernel keeps interfaces only                               | service                                   |
| Turbo/CI                                 | Merged into main CI (typecheck / lint / dep-check / test)      |                                           |

### Key Design Decisions (Responding to Open Items)

| #   | Question                             | Decision                                                                     |
| --- | ------------------------------------ | ---------------------------------------------------------------------------- |
| 1   | Main loop with zero tools at startup | Already satisfied; empty tool list enables pure chat, no special handling    |
| 2   | Skills ownership                     | **memory** (procedural memory); self handles HOOK injection                  |
| 3   | Capability layer registration        | Each package exports independently; **service layer unified register entry** |
| 4   | Migration strategy                   | **Parallel new packages + legacy rename** (this plan)                        |

### Required New-Stack Improvements

1. **TurnLifecycle unified** — ✅ `turn-lifecycle.ts` (non-streaming + streaming)
2. **engine calls db directly** — ✅ `engine-conversation` → `@freeanima/engine-db` (no SessionStore injection)
3. **AnimaService split** — ✅ `anima-service` + status/sessions/memory/messaging modules

### Layer Boundary dep-check

Script: [`scripts/check-layer-deps.ts`](../../scripts/check-layer-deps.ts), `bun run dep-check` (in `bun run check`).

| Layer             | Allowed `@freeanima/*`                                                                        | Forbidden                           |
| ----------------- | --------------------------------------------------------------------------------------------- | ----------------------------------- |
| `kernel/**`       | `kernel-*`                                                                                    | Other workspace packages            |
| `engine/**`       | `kernel-*`, `engine-*`, `service-config`, `service-logging`, `capabilities-provider-*`        | `connectors-*`, `service` (runtime) |
| `life/**`         | `kernel-*`, `life-*`, `engine-tool`, `connectors-sqlite`, `service-config`, `service-logging` | Other `connectors-*`, `service`     |
| `capabilities/**` | `kernel-*`, `engine-*`, `capabilities-*`, `life-memory`, `service-config`, `service-logging`  | `connectors-*`, `service`           |
| `connectors/**`   | Lower layers + `service`                                                                      | —                                   |
| `service/**`      | All                                                                                           | —                                   |

Test files (`**/*.{test,spec}.ts`, `**/tests/**`) and `cli/**` exempt.

### PR Split Principles

**One step per PR**; step 0 alone, not merged with step 1.

### Step 0 (Standalone PR): legacy rename

**Scope: mechanical rename only, zero logic change, no new layer directories.**

1. Existing `packages/*`, `apps/*` `package.json` → `name` to `@freeanima/legacy-*`
2. Full repo imports / workspace deps / turbo config sync update
3. Root `package.json` devDependencies, bin paths point to legacy package names
4. Run full CI (typecheck + test), must be green
5. Update `AGENTS.md` / this file with legacy package name mapping if needed (no standalone module tree doc)

**Legacy package name mapping (example):**

| Name (before step 0)      | Legacy name (after step 0)                                                 |
| ------------------------- | -------------------------------------------------------------------------- |
| `@freeanima/kernel`       | ~~`@freeanima/legacy-kernel`~~ (removed, split to kernel-_ / service-_)    |
| `@freeanima/engine`       | ~~`@freeanima/legacy-engine`~~ (removed, split to engine-\* / life-memory) |
| `@freeanima/runtime`      | `@freeanima/legacy-runtime`                                                |
| `@freeanima/memory`       | ~~`@freeanima/legacy-memory`~~ → `@freeanima/life-memory`                  |
| `@freeanima/db`           | ~~`@freeanima/legacy-db`~~ → `@freeanima/engine-db` (`engine/db`)          |
| `@freeanima/server`       | `@freeanima/legacy-server`                                                 |
| `@freeanima/gateway`      | ~~`@freeanima/legacy-gateway`~~ → `@freeanima/connectors-gateway`          |
| `@freeanima/tools`        | `@freeanima/legacy-tools` (core split to `@freeanima/capabilities-tools`)  |
| `@freeanima/integrations` | `@freeanima/legacy-integrations`                                           |
| `@freeanima/clarify`      | ~~`@freeanima/legacy-clarify`~~ → `@freeanima/capabilities-clarify`        |
| `@freeanima/api`          | `@freeanima/legacy-api`                                                    |
| `@freeanima/cli`          | `@freeanima/legacy-cli`                                                    |
| `@freeanima/webui`        | `@freeanima/legacy-webui`                                                  |

**Removed legacy packages (2026-06-05):** `@freeanima/legacy-kernel`, `@freeanima/legacy-engine`, `@freeanima/legacy-db`, `@freeanima/legacy-memory`, `@freeanima/legacy-integrations`. `packages/*` and `apps/*` legacy shells cleared (2026-06-05 L2); `@freeanima/runtime/server/tools/api/cli` etc. migrated to `service/`, `kernel/api`, `cli/` new-stack packages.

**Step 0 did not (historical):** Create `kernel/` etc.; change root `package.json` workspaces; change runtime behavior.

### Step 1 (Standalone PR): Create `kernel/`

1. Extend root `package.json` workspaces (new layer globs can be added this step or gradually)
2. Create `kernel/package.json` (`@freeanima/kernel`), pure interface skeleton + schemas
3. New kernel unit tests; legacy stack CI still green

### Current-State Assessment Summary (2026-06-05)

- RFC migration steps 0–11 **complete**
- Runtime entry: `AnimaService` (modular split in [`service/service/src/runtime/`](../../service/service/src/runtime/))
- Layer boundaries: `bun run dep-check` ([`scripts/check-layer-deps.ts`](../../scripts/check-layer-deps.ts))
- Pending migration: `life-estate` (resource layer) via shell package; `life-self` (self layer) live
