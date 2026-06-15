# FreeAnima — Agent Bootstrap Protocol

> For AI agents working in this repository (Cursor, Copilot, etc.).
> Digital-life identity: [`docs/concepts/identity.md`](docs/concepts/identity.md); self layer: [`docs/concepts/self-layer.md`](docs/concepts/self-layer.md).

## Global view

`freeanima` (FreeAnima) is a **TypeScript-only** agent runtime: `anima service` starts the Bun service (WebUI + tRPC + Gateway + engine).

| Capability     | Highlights                                                                                                                                          |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Memory         | Conversation archive (PG) → light-sleep extraction → `semantic_memory` → PG FTS retrieval; see [`docs/concepts/memory.md`](docs/concepts/memory.md) |
| Tools          | Local / MCP / ACP flat registration; implemented in `capabilities/tools/`, `capabilities/mcp/`, `capabilities/acp/`                                 |
| Credentials    | pass GPG; injected at runtime; LLM **sees paths, not values**                                                                                       |
| Data directory | `~/.anima/` (override with `FREEANIMA_HOME`); back up this directory to preserve state                                                              |
| Code layout    | `kernel/` → `core/` → `runtime/` → `capabilities/` → `platform/` (+ `cli/`) — see [`.agent/rules/code-layers.md`](.agent/rules/code-layers.md)      |

**Code is the source of truth**; do not invent tool names, endpoints, or directories from docs alone. Read source or `grep` when needed.

## Current phase: codebase attitude

The repository is in an active reshaping phase (layer migration, structural cleanup). When proposing or implementing changes, optimize for the **end-state codebase**, not for preserving today's layout.

| Priority      | Attitude                                                                                                                                                                                             |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Design goals  | **Elegant, minimal, clear** — prefer the simplest correct structure; readability and coherent boundaries beat cleverness                                                                             |
| Compatibility | **Breaking changes are fine** — do not optimize for forward compatibility, deprecation shims, or dual-path APIs unless explicitly requested                                                          |
| Cost model    | **Do not budget by human effort** — large refactors, renames, and file moves are normal; estimate scope in **AI agent turns** (read / search / edit / test cycles), not person-days or team capacity |

**Agent implications:**

- Prefer a clean end state over incremental compromise or patch-on-patch layering
- Delete and rewrite when that yields clearer structure; do not keep legacy indirection "just in case"
- Do not reject a better design because the diff is large — size is not a constraint in this phase
- When comparing options, weight structural clarity and long-term readability above migration effort

---

## Startup order

1. [GitHub Issues](https://github.com/freeanima-org/freeanima/issues) — actionable tasks and discussions
2. [Current phase: codebase attitude](#current-phase-codebase-attitude) — design goals, breaking-change policy, agent cost model
3. [`docs/concepts/architecture.md`](docs/concepts/architecture.md) — read before changing architecture / memory / credentials
4. Expand `docs/` and [`.agent/rules/`](.agent/rules/README.md) per task (see doc map below)

---

## Hard constraints (summary)

Detailed rules: [`.agent/rules/`](.agent/rules/README.md).

- Full type annotations; relative imports **must include `.ts` / `.tsx` suffix**
- Tool failures: `toolError(msg)`; structured successes: `toolResult(obj)`; LLM-readable tools may return plain-text stdout
- New features need colocated unit tests; integration in `tests/integration/` — see [`.agent/rules/testing.md`](.agent/rules/testing.md)
- Layer deps and Registry injection enforced — see [`.agent/rules/code-layers.md`](.agent/rules/code-layers.md) and [`scripts/check-layer-deps.ts`](scripts/check-layer-deps.ts)
- **Do not manually edit [`CHANGELOG.md`](CHANGELOG.md)** — Release Please only ([`.agent/rules/release.md`](.agent/rules/release.md))
- PG migrations: `db:generate` then `db:migrate`; never skip `snapshot.json` — [`.agent/rules/coding.md`](.agent/rules/coding.md) § PG migrations
- PG repository queries: Drizzle ORM only — **`db.execute` forbidden** in `db-pg` / `tests/integration` — [`.agent/rules/drizzle-db.md`](.agent/rules/drizzle-db.md)
- Credentials and secrets never in git / logs / tool returns; memory/self-layer changes need extra care ([`docs/concepts/identity.md`](docs/concepts/identity.md))
- **Principle maintenance**: corrections or refinements to direction, principles, philosophy, or agent behavior norms must be written to the appropriate doc layer in the same task/PR — not code-only. Triage: product/cognitive → `docs/concepts/`; implementation constraints → `.agent/rules/`; bootstrap summary → `AGENTS.md` (see [Principle & direction maintenance](#principle--direction-maintenance) below)

### Type ownership (decision order only)

1. PG storage (DDL + JSONB Zod) → `@freeanima/core/db` — [`core/src/db/schema/`](core/src/db/schema/)
2. Repository ports → `@freeanima/core/repos` — [`core/src/repos/ports/`](core/src/repos/ports/)
3. Domain types → owner package; do not duplicate storage Zod in docs — use source as SSOT

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

# PG schema changes (must generate snapshot.json; see .agent/rules/coding.md)
DATABASE_URL="…" bun run --filter @freeanima/core db:generate
DATABASE_URL="…" bun run --filter @freeanima/core db:migrate
```

- WebUI Chamber: `http://127.0.0.1:2658/chamber/dashboard`
- Parlor satellite: `http://127.0.0.1:4174`
- Pair-programming satellite: `http://127.0.0.1:4173`
- Release: [`.agent/rules/release.md`](.agent/rules/release.md)
- PG ops (install, backup): [`docs/guide/database.md`](docs/guide/database.md)

---

## Doc map

| File                                                               | Role                                                             |
| ------------------------------------------------------------------ | ---------------------------------------------------------------- |
| [`AGENTS.md`](AGENTS.md)                                           | Bootstrap protocol, current-phase codebase attitude (this file)  |
| [`.agent/rules/`](.agent/rules/README.md)                          | Implementation constraints (layers, tests, coding, DB, packages) |
| [GitHub Issues](https://github.com/freeanima-org/freeanima/issues) | Actionable tasks and discussions                                 |
| [`docs/concepts/architecture.md`](docs/concepts/architecture.md)   | Architecture principles and direction                            |
| [`docs/concepts/`](docs/concepts/)                                 | Core concepts (memory, self layer, etc.)                         |
| [`docs/guide/`](docs/guide/)                                       | Usage and maintenance (security, database ops)                   |
| [`docs/features/`](docs/features/)                                 | Major product capabilities                                       |
| [`docs/sap/`](docs/sap/)                                           | Satellite Application Protocol (SAP)                             |
| [`docs/tools/`](docs/tools/)                                       | General/minor built-in tools                                     |

---

## Principle & direction maintenance

Corrections or refinements to direction, principles, philosophy, or agent behavior norms **must not live only in code or conversation**. Code remains SSOT for behavior, but agent-readable principles must be written to disk in the same task/PR.

### Triage

| Change nature                                                       | Where to write                                                                                                              | Examples                                                  |
| ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| Product / cognitive architecture, long-lived design direction       | [`docs/concepts/architecture.md`](docs/concepts/architecture.md) → topic doc when needed (`memory.md`, `identity.md`, etc.) | Four-layer model, memory pipeline principles              |
| Agent implementation constraints (coding, testing, layers, release) | [`.agent/rules/*.md`](.agent/rules/README.md) — matching topic file                                                         | Drizzle query conventions, layer deps, test mock strategy |
| Bootstrap summary, hard-constraint list, doc-map-level changes      | [`AGENTS.md`](AGENTS.md) — keep brief; link to detail docs                                                                  | New global hard constraint, conflict-priority adjustment  |

### Triggers

- User or maintainer explicitly corrects or refines a principle in conversation
- Code implements a principle that contradicts or extends existing docs
- Issue or PR changes architecture direction or expected agent behavior

### Agent checklist

- Principle change and doc diff land in the **same PR** (or same commit batch) — not "code now, docs later"
- After editing `.agent/rules/`, check whether `AGENTS.md` hard-constraint summary needs a one-line update
- After editing `docs/concepts/`, check whether `AGENTS.md` doc map and conflict priority remain accurate

---

## Conflict priority

1. **Code implementation** > all docs
2. **`docs/concepts/architecture.md`** > other `docs/**/*.md`
3. **GitHub Issues** > architecture direction planning

## Docs to update when code changes

| Change type                                                | Update                                                                                             |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| PG schema / DDL                                            | [`core/src/db/schema/`](core/src/db/schema/) + [`.agent/rules/coding.md`](.agent/rules/coding.md)  |
| PG query conventions (ORM vs execute)                      | [`.agent/rules/drizzle-db.md`](.agent/rules/drizzle-db.md)                                         |
| PG ops (install, backup, migrate UX)                       | [`docs/guide/database.md`](docs/guide/database.md)                                                 |
| Layer deps / composition root / Registry                   | [`.agent/rules/code-layers.md`](.agent/rules/code-layers.md) + confirm `check-layer-deps.ts`       |
| Test strategy / mock tiers                                 | [`.agent/rules/testing.md`](.agent/rules/testing.md) + [`tests/README.md`](tests/README.md)        |
| Memory pipeline / retrieval                                | [`docs/concepts/memory.md`](docs/concepts/memory.md) + architecture                                |
| Security / threat surface                                  | [`docs/guide/security.md`](docs/guide/security.md) + architecture                                  |
| Architecture principles                                    | [`docs/concepts/architecture.md`](docs/concepts/architecture.md)                                   |
| Principle / direction / philosophy correction (any source) | Triage per [Principle & direction maintenance](#principle--direction-maintenance); same PR as code |
| New RFC package / rename                                   | [`.agent/rules/packages.md`](.agent/rules/packages.md)                                             |
| Release                                                    | [`.agent/rules/release.md`](.agent/rules/release.md)                                               |
| Compression algorithm                                      | [`.agent/rules/compression.md`](.agent/rules/compression.md)                                       |
| UI / docs i18n (Paraglide, po4a, PO)                       | [`.agent/rules/i18n.md`](.agent/rules/i18n.md)                                                     |
| Task done                                                  | close corresponding GitHub Issue; user-visible changes use Conventional Commits                    |

Tool tables, module trees, API lists **are not maintained in docs** — use registration code and service router as source of truth.

## Maintenance conventions

- Principle / direction corrections: triage per [Principle & direction maintenance](#principle--direction-maintenance) — product/cognitive → `docs/concepts/`; implementation constraints → `.agent/rules/`; bootstrap summary → `AGENTS.md`
- New topic >50 lines and long-lived → `docs/` or `.agent/rules/`; actionable items → GitHub Issue
- Close Issue when task done; do not keep completed items in docs
- **docs layout**: deploy/credentials → `docs/guide/`; cognitive mechanisms → `docs/concepts/`; major product features → `docs/features/`; general tools → `docs/tools/`; agent implementation rules → `.agent/rules/`

## What each file must not contain

| File                          | Forbidden                                                                                    |
| ----------------------------- | -------------------------------------------------------------------------------------------- |
| AGENTS.md (this file)         | Full tool table, directory tree, API cross-ref, SemVer details, domain type inventory tables |
| `.agent/rules/*.md`           | Product architecture essays, weekly-changing tool lists                                      |
| docs/concepts/architecture.md | Concrete todos, weekly-changing tool lists                                                   |
| CHANGELOG.md                  | Manual add/remove of version sections or entries (Release Please maintains)                  |
