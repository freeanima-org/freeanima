# FreeAnima — Agent Bootstrap Protocol

> For AI agents working in this repository (Cursor, Copilot, etc.).
> Digital-life identity: [`docs/concepts/identity.md`](docs/concepts/identity.md); self layer: [`docs/concepts/self-layer.md`](docs/concepts/self-layer.md).

## Global view

`freeanima` (FreeAnima) is a **TypeScript-only** agent runtime: 源码用 `bun run dev:hub` 起 Bun Hub；standalone 安装版用 `anima service`（Hub RPC REST/WS `/hub/rpc/v1` + MCP `/mcp` + engine）；UI 由 `src/app/shell/desktop` / `src/app/shell/mobile` bundled 提供。

| Capability     | Highlights                                                                                                                                                                                                          |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Memory         | Conversation archive (PG) → light-sleep extraction → `semantic_memory` → PG FTS retrieval; see [`docs/concepts/memory.md`](docs/concepts/memory.md)                                                                 |
| Tools          | Local / MCP / ACP flat registration; MCP client `src/capabilities/mcp-client/`、MCP server `/mcp` `src/capabilities/mcp-server/`；tools `src/capabilities/tools/`、ACP `src/capabilities/acp/`                      |
| Secrets        | Vault (User/Agent libraries); config `vault()` / `env()`; LLM **sees metadata, not values**                                                                                                                         |
| Data directory | `~/.anima/` (override with `FREEANIMA_HOME`); back up this directory to preserve state                                                                                                                              |
| Code layout    | 产品代码在 `src/`（`features/`、`app/shell/`、`platform/` 等）— 见 [`docs/concepts/repository-topology.md`](docs/concepts/repository-topology.md)；Desktop/Mobile 安装包内嵌 `web/dist`，浏览器/PWA 用 Hub `/web/*` |

**Code is the source of truth**; do not invent tool names, endpoints, or directories from docs alone. Read source or `grep` when needed.

## Product design principles

Directional heuristics for _what_ FreeAnima should feel like. Mechanisms and cognitive architecture live in [`docs/concepts/`](docs/concepts/) — related, but not a 1:1 rule list.

- **Platform-native UX** — Mobile and desktop are **separate interaction and layout designs**, not one responsive skin stretched across form factors. Shared contracts (API, SAP, settings keys) may exist; presentation and interaction patterns should fit each platform. **Two-layer model:** **capability layer** (`satelliteShell`, `detectShellRuntimeKind`: storage, IPC, Keyboard, long-press vs right-click, swipe gestures, settings registry **content**) is shell-native; **layout layer** is viewport-only (narrow `< md` / 768px → `compact` mobile layout / bottom-nav + drawer; `≥ md` → `expanded` desktop layout / left rail + three-column). Shell does **not** lock layout (Electron narrow window may use bottom-nav; Capacitor iPad wide may use left rail). `detectPlatform()` is settings **chrome** only (tabs vs sidebar), following layout coarse tier—not shell type. Phone is usually narrow but **phone ≠ narrow layout**.
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
bun install && bun run check # before PR: typecheck + lint + format + test:changed
bun run lint # oxlint + oxlint-tsgolint（.oxlintrc.json options.typeAware）
bun run lint:fix
bun run test:changed # local / pre-commit (unit changed only)
bun run test:unit # all unit tests
bun run test:integration # integration (tests/integration/)
bun run test # unit + integration（串行）
bun run dev:hub # 源码起 Hub（前台，可 --port；不经 anima service）；启动不自动 build Web
bun run dev:web # 浏览器全壳层开发（Vite HMR :4173；需 Hub 已运行）
# anima service … # 仅 standalone 安装版 CLI（源码 anima 无此子命令）
bun run build:web # 源码部署 / 托管 /web 前构建（可用 FREEANIMA_WEB_SKIP_PWA=1 跳过 SW；standalone 打包若 dist 未过期会跳过）
# anima vault list # agent vault item metadata; use Shell /vault for User library

# PG schema changes (must generate snapshot.json; see .agent/rules/coding.md)
DATABASE_URL="…" bunx drizzle-kit generate --config src/core/drizzle.config.ts
DATABASE_URL="…" bunx drizzle-kit migrate --config src/core/drizzle.config.ts
```

- Hub API：`http://127.0.0.1:2658/hub/rpc/v1`（开发用 `dev:hub`；生产用 standalone `anima service`；`web.enabled` 且已有 dist 时托管 `/web/*`）
- Web 形态：standalone / 源码部署须先有 `build:web`（打包时强制；源码部署手动）；dev 用 `dev:hub` + `dev:web`（HMR，不依赖落盘）
- 桌面/移动/浏览器开发客户端：聊天室 + 管理台 UI 在 `src/app/shell/desktop` / `mobile` / `web`（web 仅本地调试）
- Dev UI：`bun run dev:web` → `http://127.0.0.1:4173/web/chat`（Console：`/web/console/dashboard`）
- Release: [`.agent/rules/release.md`](.agent/rules/release.md)
- PG ops (install, backup): [`docs/guide/database.md`](docs/guide/database.md)
- Remote access (Service API Token / LAN): [`docs/guide/remote-access.md`](docs/guide/remote-access.md)

---

## Doc map

| File                                                                           | Role                                                             |
| ------------------------------------------------------------------------------ | ---------------------------------------------------------------- |
| [`AGENTS.md`](AGENTS.md)                                                       | Bootstrap protocol, product & code principles (this file)        |
| [`.agent/rules/`](.agent/rules/README.md)                                      | Implementation constraints (layers, tests, coding, DB, packages) |
| [GitHub Issues](https://github.com/freeanima-org/freeanima/issues)             | Actionable tasks and discussions                                 |
| [`docs/concepts/architecture.md`](docs/concepts/architecture.md)               | Architecture principles and direction                            |
| [`docs/concepts/repository-topology.md`](docs/concepts/repository-topology.md) | Repo layout Phase 0 audit; shared/frontend migration target      |
| [`docs/concepts/`](docs/concepts/)                                             | Core concepts (memory, self layer, etc.)                         |
| [`docs/guide/`](docs/guide/)                                                   | Usage and maintenance (security, database ops)                   |
| [`docs/features/`](docs/features/)                                             | Major product capabilities                                       |
| [`docs/sap/`](docs/sap/)                                                       | Satellite Application Protocol (SAP)                             |
| [`docs/tools/`](docs/tools/)                                                   | General/minor built-in tools                                     |

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

When sources conflict: **implemented behavior** follows code (and topic docs that match code, e.g. [`sleep.md`](docs/concepts/sleep.md) for sleep scheduling). **Open enhancement Issues** may describe future direction that overrides stale planning prose but not shipped code.

## Docs to update when code changes

| Change type                                                | Update                                                                                                                                                                                   |
| ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PG schema / DDL                                            | [`src/core/db/schema/`](src/core/db/schema/) + [`.agent/rules/coding.md`](.agent/rules/coding.md) — **include data backfill in the same migration SQL when dropping or renaming tables** |
| PG query conventions (ORM vs execute)                      | [`.agent/rules/drizzle-db.md`](.agent/rules/drizzle-db.md) — queries in `src/core/db/pg/`; capabilities use `@freeanima/core/db/pg/*` directly (no `engine.repos`)                       |
| PG ops (install, backup, migrate UX)                       | [`docs/guide/database.md`](docs/guide/database.md) · [`docs/guide/remote-access.md`](docs/guide/remote-access.md) for Token / LAN                                                        |
| Layer deps / composition root / Registry                   | [`.agent/rules/code-layers.md`](.agent/rules/code-layers.md)                                                                                                                             |
| Test strategy / mock tiers                                 | [`.agent/rules/testing.md`](.agent/rules/testing.md) + [`tests/README.md`](tests/README.md)                                                                                              |
| Memory pipeline / retrieval                                | [`docs/concepts/memory.md`](docs/concepts/memory.md) + architecture                                                                                                                      |
| Security / threat surface                                  | [`docs/guide/security.md`](docs/guide/security.md) + architecture                                                                                                                        |
| Architecture principles                                    | [`docs/concepts/architecture.md`](docs/concepts/architecture.md)                                                                                                                         |
| Principle / direction / philosophy correction (any source) | Triage per [Principle & direction maintenance](#principle--direction-maintenance); same PR as code                                                                                       |
| New RFC package / rename                                   | [`.agent/rules/packages.md`](.agent/rules/packages.md)                                                                                                                                   |
| Release                                                    | [`.agent/rules/release.md`](.agent/rules/release.md)                                                                                                                                     |
| Electron 桌面壳 main 打包 / 安装包启动                     | [`.agent/rules/electron-desktop.md`](.agent/rules/electron-desktop.md)                                                                                                                   |
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
