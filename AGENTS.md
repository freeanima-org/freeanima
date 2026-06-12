# FreeAnima — Agent Bootstrap Protocol

> For AI agents working in this repository (Cursor, Copilot, etc.).
> Digital-life identity: [`docs/concepts/identity.md`](docs/concepts/identity.md); self layer: [`docs/concepts/self-layer.md`](docs/concepts/self-layer.md).

## Global view

`freeanima` (FreeAnima) is a **TypeScript-only** agent runtime: `anima service` starts the Bun service (WebUI + tRPC + Gateway + engine).

| Capability     | Highlights                                                                                                                                                                  |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Memory         | Conversation archive (PG) → light-sleep extraction → `semantic_memory` → PG FTS retrieval; see [`docs/concepts/memory.md`](docs/concepts/memory.md)                         |
| Tools          | Local / MCP / ACP flat registration; implemented in `capabilities/tools/`, `capabilities/mcp/`, `capabilities/acp/`                                                         |
| Credentials    | pass GPG; injected at runtime; LLM **sees paths, not values**                                                                                                               |
| Data directory | `~/.anima/` (override with `FREEANIMA_HOME`); back up this directory to preserve state                                                                                      |
| Code layout    | `kernel/`, `storage/`, `mechanism/`, `orchestration/`, `capabilities/`, `connectors/`, `service/`, `cli/`; see [`.agent/rules/code-layers.md`](.agent/rules/code-layers.md) |

**Code is the source of truth**; do not invent tool names, endpoints, or directories from docs alone. Read source or `grep` when needed.

---

## Startup order

1. [GitHub Issues](https://github.com/freeanima-org/freeanima/issues) — actionable tasks and discussions
2. [`docs/concepts/architecture.md`](docs/concepts/architecture.md) — read before changing architecture / memory / credentials
3. Expand `docs/` and [`.agent/rules/`](.agent/rules/README.md) per task (see doc map below)

---

## Hard constraints (summary)

Detailed rules: [`.agent/rules/`](.agent/rules/README.md).

- Full type annotations; relative imports **must include `.ts` / `.tsx` suffix**
- Tool failures: `toolError(msg)`; structured successes: `toolResult(obj)`; LLM-readable tools may return plain-text stdout
- New features need colocated unit tests; integration in `tests/integration/` — see [`.agent/rules/testing.md`](.agent/rules/testing.md)
- Layer deps and Registry injection enforced — see [`.agent/rules/code-layers.md`](.agent/rules/code-layers.md) and [`scripts/check-layer-deps.ts`](scripts/check-layer-deps.ts)
- **Do not manually edit [`CHANGELOG.md`](CHANGELOG.md)** — Release Please only ([`.agent/rules/release.md`](.agent/rules/release.md))
- PG migrations: `db:generate` then `db:migrate`; never skip `snapshot.json` — [`.agent/rules/coding.md`](.agent/rules/coding.md) § PG migrations
- PG repository queries: prefer Drizzle ORM; `db.execute` only when necessary — [`.agent/rules/drizzle-db.md`](.agent/rules/drizzle-db.md)
- Credentials and secrets never in git / logs / tool returns; memory/self-layer changes need extra care ([`docs/concepts/identity.md`](docs/concepts/identity.md))

### Type ownership (decision order only)

1. PG storage (DDL + JSONB Zod) → `storage-db` — [`storage/db/src/schema/`](storage/db/src/schema/)
2. Repository ports → `storage-repos` — [`storage/repos/src/ports/`](storage/repos/src/ports/)
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
DATABASE_URL="…" bun run --filter @freeanima/storage-db db:generate
DATABASE_URL="…" bun run --filter @freeanima/storage-db db:migrate
```

- WebUI parlor: `http://127.0.0.1:2658/webui/parlor/chat`
- Release: [`.agent/rules/release.md`](.agent/rules/release.md)
- PG ops (install, backup): [`docs/guide/database.md`](docs/guide/database.md)

---

## Doc map

| File                                                               | Role                                                             |
| ------------------------------------------------------------------ | ---------------------------------------------------------------- |
| [`AGENTS.md`](AGENTS.md)                                           | Bootstrap protocol (this file)                                   |
| [`.agent/rules/`](.agent/rules/README.md)                          | Implementation constraints (layers, tests, coding, DB, packages) |
| [GitHub Issues](https://github.com/freeanima-org/freeanima/issues) | Actionable tasks and discussions                                 |
| [`docs/concepts/architecture.md`](docs/concepts/architecture.md)   | Architecture principles and direction                            |
| [`docs/concepts/`](docs/concepts/)                                 | Core concepts (memory, self layer, etc.)                         |
| [`docs/guide/`](docs/guide/)                                       | Usage and maintenance (security, database ops)                   |
| [`docs/features/`](docs/features/)                                 | Major product capabilities                                       |
| [`docs/tools/`](docs/tools/)                                       | General/minor built-in tools                                     |

---

## Conflict priority

1. **Code implementation** > all docs
2. **`docs/concepts/architecture.md`** > other `docs/**/*.md`
3. **GitHub Issues** > architecture direction planning

## Docs to update when code changes

| Change type                              | Update                                                                                                  |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| PG schema / DDL                          | [`storage/db/src/schema/`](storage/db/src/schema/) + [`.agent/rules/coding.md`](.agent/rules/coding.md) |
| PG query conventions (ORM vs execute)    | [`.agent/rules/drizzle-db.md`](.agent/rules/drizzle-db.md)                                              |
| PG ops (install, backup, migrate UX)     | [`docs/guide/database.md`](docs/guide/database.md)                                                      |
| Layer deps / composition root / Registry | [`.agent/rules/code-layers.md`](.agent/rules/code-layers.md) + confirm `check-layer-deps.ts`            |
| Test strategy / mock tiers               | [`.agent/rules/testing.md`](.agent/rules/testing.md) + [`tests/README.md`](tests/README.md)             |
| Memory pipeline / retrieval              | [`docs/concepts/memory.md`](docs/concepts/memory.md) + architecture                                     |
| Security / threat surface                | [`docs/guide/security.md`](docs/guide/security.md) + architecture                                       |
| Architecture principles                  | [`docs/concepts/architecture.md`](docs/concepts/architecture.md)                                        |
| New RFC package / rename                 | [`.agent/rules/packages.md`](.agent/rules/packages.md)                                                  |
| Release                                  | [`.agent/rules/release.md`](.agent/rules/release.md)                                                    |
| Compression algorithm                    | [`.agent/rules/compression.md`](.agent/rules/compression.md)                                            |
| UI / docs i18n (Paraglide, po4a, PO)     | [`.agent/rules/i18n.md`](.agent/rules/i18n.md)                                                          |
| Task done                                | close corresponding GitHub Issue; user-visible changes use Conventional Commits                         |

Tool tables, module trees, API lists **are not maintained in docs** — use registration code and service router as source of truth.

## Maintenance conventions

- Principle changes first in [`docs/concepts/architecture.md`](docs/concepts/architecture.md), then decide on a topic doc
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
