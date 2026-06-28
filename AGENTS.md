# FreeAnima — Agent Bootstrap Protocol

> For AI agents working in this repository (Cursor, Copilot, etc.).
> Digital-life identity: [`docs/concepts/identity.md`](docs/concepts/identity.md); self layer: [`docs/concepts/self-layer.md`](docs/concepts/self-layer.md).

## Global view

`freeanima` (FreeAnima) is a **TypeScript-only** agent runtime: `anima service` starts the Bun Hub（REST `/api` + SAP `/sap/v1` + engine）；UI 由 app/desktop / app/mobile bundled 提供。

| Capability     | Highlights                                                                                                                                                                     |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Memory         | Conversation archive (PG) → light-sleep extraction → `semantic_memory` → PG FTS retrieval; see [`docs/concepts/memory.md`](docs/concepts/memory.md)                            |
| Tools          | Local / MCP / ACP flat registration; MCP client `capabilities/mcp-client/`、MCP server `/mcp` `capabilities/mcp-server/`；tools `capabilities/tools/`、ACP `capabilities/acp/` |
| Credentials    | pass GPG; injected at runtime; LLM **sees paths, not values**                                                                                                                  |
| Data directory | `~/.anima/` (override with `FREEANIMA_HOME`); back up this directory to preserve state                                                                                         |
| Code layout    | `kernel/` → `core/` → `runtime/` → `capabilities/` → `platform/` (+ `app/`) — see [`.agent/rules/code-layers.md`](.agent/rules/code-layers.md)                                 |

**Code is the source of truth**; do not invent tool names, endpoints, or directories from docs alone. Read source or `grep` when needed.

## Product design principles

Directional heuristics for _what_ FreeAnima should feel like. Mechanisms and cognitive architecture live in [`docs/concepts/`](docs/concepts/) — related, but not a 1:1 rule list.

- **Platform-native UX** — Mobile and desktop are **separate interaction and layout designs**, not one responsive skin stretched across form factors. Shared contracts (API, SAP, settings keys) may exist; presentation and interaction patterns should fit each platform. **Two-layer model:** shell/capability layer (Electron, Capacitor, companion, Hub wiring) is platform-native today; **UI layer** uses a shared SPA (`packages/shell-ui` + satellites) but **must branch on `detectPlatform()`** (not viewport breakpoints alone) for nav, information architecture, and primary layouts. Responsive CSS is allowed only as a **desktop window-resize** aid, not as the mobile layout selector.
- **Concept convergence over feature sprawl** — As capabilities grow, **resist cognitive overload**: keep a small set of core concepts visible and stable; new features should map onto existing mental models rather than multiplying parallel abstractions in the UI.

## Code implementation principles

How agents should _shape_ changes. Hard checks and conventions → [`.agent/rules/`](.agent/rules/README.md) — related, but not a 1:1 rule list.

- **Testability by design** — Structure code so behavior can be verified: colocated unit tests for package logic, integration tests when boundaries cross packages or touch real persistence; design for injection and clear seams — see [`.agent/rules/testing.md`](.agent/rules/testing.md).
- **Elegant, minimal architecture** — Prefer the **simplest correct structure**; readable boundaries beat clever indirection. The repository is in an active reshaping phase — optimize for the **end-state codebase**; large refactors and breaking changes are acceptable when clarity wins.
- **No speculative layering** — Do not introduce abstractions, extension points, or parallel APIs for **unused or far-future** needs; add structure when a second real consumer exists, not when imagining one.

---

## Startup order

1. [GitHub Issues](https://github.com/freeanima-org/freeanima/issues) — actionable tasks and discussions
2. [Product design principles](#product-design-principles) — what to build and how to present it
3. [Code implementation principles](#code-implementation-principles) — how to shape changes
4. [`docs/concepts/architecture.md`](docs/concepts/architecture.md) — read before changing architecture / memory / credentials
5. Open matching files in [`.agent/rules/`](.agent/rules/README.md) per task (see doc map below)

---

## Common commands

```bash
bun install && bun run check # before PR: typecheck + lint + format + tests
bun run test:changed # local / pre-commit (unit changed only)
bun run test:unit # all unit tests
bun run test:integration # integration (tests/integration/)
bun run test # unit + integration in parallel
bun run service start --foreground # Hub API + SAP（:2658）
bun run dev:web # 浏览器全壳层开发（Chat + Admin + 任务 + 设置，Vite HMR，需 Hub 已运行）
anima credential list # credential paths; values in pass

# PG schema changes (must generate snapshot.json; see .agent/rules/coding.md)
DATABASE_URL="…" bun run --filter @freeanima/core db:generate
DATABASE_URL="…" bun run --filter @freeanima/core db:migrate
```

- Hub API：`http://127.0.0.1:2658/api`（`anima service` 仅托管后端）
- 桌面/移动/浏览器开发客户端：聊天室 + 管理台 UI 在 `app/desktop` / `app/mobile` / `app/web`（web 仅本地调试）
- Admin / 任务 本地开发：`bun run dev:web` → `http://127.0.0.1:4173/chat`（Admin：`/admin/dashboard`）
- Web 全壳层本地开发：`bun run dev:web` → `http://127.0.0.1:4173/chat`
- Release: [`.agent/rules/release.md`](.agent/rules/release.md)
- PG ops (install, backup): [`docs/guide/database.md`](docs/guide/database.md)
- Remote access (Cloudflare Tunnel): [`docs/guide/remote-access.md`](docs/guide/remote-access.md)

---

## Doc map

| File                                                               | Role                                                             |
| ------------------------------------------------------------------ | ---------------------------------------------------------------- |
| [`AGENTS.md`](AGENTS.md)                                           | Bootstrap protocol, product & code principles (this file)        |
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
| Bootstrap summary, high-level principles, doc-map-level changes     | [`AGENTS.md`](AGENTS.md) — keep brief; link to detail docs                                                                  | New product/code principle, conflict-priority adjustment  |

### Triggers

- User or maintainer explicitly corrects or refines a principle in conversation
- Code implements a principle that contradicts or extends existing docs
- Issue or PR changes architecture direction or expected agent behavior

### Agent checklist

- Principle change and doc diff land in the **same PR** (or same commit batch) — not "code now, docs later"
- After editing `.agent/rules/`, check whether a new implementation constraint belongs in `.agent/rules/` only, or also warrants a one-line update under [Code implementation principles](#code-implementation-principles)
- After editing `docs/concepts/`, check whether `AGENTS.md` doc map and conflict priority remain accurate

---

## Conflict priority

1. **Code implementation** > all docs
2. **`docs/concepts/architecture.md`** > other `docs/**/*.md`
3. **GitHub Issues** > architecture direction planning

## Docs to update when code changes

| Change type                                                | Update                                                                                                                                                                                   |
| ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PG schema / DDL                                            | [`core/src/db/schema/`](core/src/db/schema/) + [`.agent/rules/coding.md`](.agent/rules/coding.md) — **include data backfill in the same migration SQL when dropping or renaming tables** |
| PG query conventions (ORM vs execute)                      | [`.agent/rules/drizzle-db.md`](.agent/rules/drizzle-db.md)                                                                                                                               |
| PG ops (install, backup, migrate UX)                       | [`docs/guide/database.md`](docs/guide/database.md) · [`docs/guide/remote-access.md`](docs/guide/remote-access.md) for Tunnel                                                             |
| Layer deps / composition root / Registry                   | [`.agent/rules/code-layers.md`](.agent/rules/code-layers.md) + confirm `check-layer-deps.ts`                                                                                             |
| Test strategy / mock tiers                                 | [`.agent/rules/testing.md`](.agent/rules/testing.md) + [`tests/README.md`](tests/README.md)                                                                                              |
| Memory pipeline / retrieval                                | [`docs/concepts/memory.md`](docs/concepts/memory.md) + architecture                                                                                                                      |
| Security / threat surface                                  | [`docs/guide/security.md`](docs/guide/security.md) + architecture                                                                                                                        |
| Architecture principles                                    | [`docs/concepts/architecture.md`](docs/concepts/architecture.md)                                                                                                                         |
| Principle / direction / philosophy correction (any source) | Triage per [Principle & direction maintenance](#principle--direction-maintenance); same PR as code                                                                                       |
| New RFC package / rename                                   | [`.agent/rules/packages.md`](.agent/rules/packages.md)                                                                                                                                   |
| Release                                                    | [`.agent/rules/release.md`](.agent/rules/release.md)                                                                                                                                     |
| Compression algorithm                                      | [`.agent/rules/compression.md`](.agent/rules/compression.md)                                                                                                                             |
| UI / docs i18n (Paraglide, po4a, PO)                       | [`.agent/rules/i18n.md`](.agent/rules/i18n.md)                                                                                                                                           |
| Task done                                                  | close corresponding GitHub Issue; user-visible changes use Conventional Commits                                                                                                          |

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
