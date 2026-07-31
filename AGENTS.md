# FreeAnima — Agent Bootstrap Protocol

> For AI agents working in this repository (Cursor, Copilot, etc.).
> Digital-life identity: [`docs/product/identity.md`](docs/product/identity.md); self layer: [`docs/cognition/self-layer.md`](docs/cognition/self-layer.md).

## Global view

`freeanima` (FreeAnima) is an agent runtime: **product / Habitat logic is TypeScript-only**; **Portal Shell** is **Tauri**（Rust host + shared `web/dist-*` UI）。Product name for the long-running process is **Habitat**（栖息地）; **Portal**（入口）四形态：application（Shell）/ browser（扩展）/ mcp（`/mcp`）/ cli。Source: `just dev` / `just dev habitat`；standalone: `anima service`（协议侧仍为 Habitat RPC `/rpc/v1` + MCP `/mcp` + engine）; UI from `src/portal/app/tauri` + `src/portal/app/web`. Naming: [`docs/product/architecture.md`](docs/product/architecture.md) Product naming + [`i18n/glossary.md`](i18n/glossary.md)；入口模块 [`docs/modules/portal.md`](docs/modules/portal.md)。Shell rules: [`.agent/rules/tauri-shell.md`](.agent/rules/tauri-shell.md).

| Capability     | Highlights                                                                                                                                                                                                                                                                                |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Memory         | Conversation archive (PG) → light-sleep extraction → `semantic_memory` → PG FTS retrieval; see [`docs/cognition/memory.md`](docs/cognition/memory.md)                                                                                                                                     |
| Tools          | Local / MCP flat registration; MCP client `src/host/capabilities/mcp-client/`、MCP server `/mcp` `src/host/capabilities/mcp-server/`；unreachable local apps may register remote tools over Habitat RPC；tools `src/host/capabilities/tools/`；internal subagent `src/features/subagent/` |
| Secrets        | Vault (User/Agent libraries); bootstrap `env()`；runtime `vault()` / `env()`; LLM **sees metadata, not values**                                                                                                                                                                           |
| Data directory | `~/.anima/` / `%USERPROFILE%\.anima` (override with `FREEANIMA_HOME`); back up this directory to preserve state                                                                                                                                                                           |
| Code layout    | 产品代码在 `src/`（`host/`、`client/`、`ui-kit/`、`features/`、`shared/`、`portal/{app,extension,cli}/`）— 见 [`.agent/rules/repository-topology.md`](.agent/rules/repository-topology.md)；Desktop/Mobile 安装包内嵌 `web/dist`，浏览器/PWA 用 Habitat `/web/*`                          |

**Code is the source of truth**; do not invent tool names, endpoints, or directories from docs alone. Read source or `grep` when needed.

## Product design principles

Directional heuristics for _what_ FreeAnima should feel like. Mechanisms and cognitive architecture live in [`docs/product/`](docs/product/) and [`docs/cognition/`](docs/cognition/) — related, but not a 1:1 rule list.

- **Platform-native UX** — Mobile and desktop are **separate interaction and layout designs**, not one responsive skin stretched across form factors. Shared contracts (API, Habitat RPC, settings keys) may exist; presentation and interaction patterns should fit each dimension value. **Shell** = Portal 宿主（browser/Tauri；形态 web/desktop/mobile），**≠** 侧栏/底栏/设置 chrome（那是 **app frame** / 应用布局）。**Three orthogonal dimensions**（规范 [`docs/ui/`](docs/ui/overview.md)；Agent API [`.agent/rules/ui-dimensions.md`](.agent/rules/ui-dimensions.md)）：**壳子**（能力）、**布局**（`compact`/`expanded` 视口）、**交互**（`pointer`/`touch`）。视觉 / 组件 / 交互均按三维适配。壳**不**锁布局。Phone 通常窄，但 **phone ≠ 窄布局**。
- **Habitat & Portal** — User copy: **栖息地 / Habitat** = long-running place (multi digital life + human assets); **入口 / Portal** = 四形态（应用 Shell / 浏览器扩展 / MCP `/mcp` / CLI）。协议/代码标识仍写 Habitat（`/rpc/v1`）。见 [`docs/product/architecture.md`](docs/product/architecture.md) Product naming、[`i18n/glossary.md`](i18n/glossary.md)、[`docs/modules/portal.md`](docs/modules/portal.md)。
- **Tools: MCP first, remote registration rare** — Dialable peers exchange tools via **MCP**. Only unreachable local apps (no stable inbound listener; e.g. desktop companion) **actively connect** to Habitat and register remote tools over Habitat RPC (`instance_id` routes `tool.call`). Product UI uses Habitat RPC only — never remote-tool attach. See architecture Client UI / companion sections.
- **Concept convergence over feature sprawl** — As capabilities grow, **resist cognitive overload**: keep a small set of core concepts visible and stable; new features should map onto existing mental models rather than multiplying parallel abstractions in the UI.

## Code implementation principles

How agents should _shape_ changes. Hard checks and conventions → [`.agent/rules/`](.agent/rules/README.md) — related, but not a 1:1 rule list.

- **Right path over minimal diff** — Do not optimize for the smallest patch first. Choose the approach that fits the intended **end-state** and stays correct as the codebase evolves—even when that means a larger refactor or breaking change. Executing a wrong structure carefully is still the wrong outcome; pick the right thing, then do it well. Scope the structural fix that the problem actually needs—not speculative layering, and not unrelated drive-by cleanup.
- **Testability by design** — Structure code so behavior can be verified: colocated unit tests for package logic, integration tests when boundaries cross packages or touch real persistence; design for injection and clear seams — see [`.agent/rules/testing.md`](.agent/rules/testing.md). **PG integration 禁止**把 `ANIMA_TEST_PG_URL` 指到与日常 `~/.anima/config.yaml` **同 host:port** 的库（护栏 skip + throw）；须经 `just qa test-integration`（Docker 临时 PG、模板库克隆、无 `clearPgTables`）或等价隔离实例。
- **Elegant, simple architecture** — Prefer the **simplest correct structure for the end-state** (simplicity of design, not of the diff); readable boundaries beat clever indirection. The repository is in an active reshaping phase — optimize for the **end-state codebase**; large refactors and breaking changes are acceptable when clarity wins. Complements **Right path over minimal diff**.
- **Prefer mature community solutions** — When a lightweight, mature community solution fits, do **not** invent a parallel in-house stack. UI primitives stay on **shadcn** (React Aria); cross-cutting helpers reuse existing deps / `@freeanima/ui-kit` / `host` utils before adding another library. Product-domain mechanisms (Habitat RPC, Portal offline/outbox, cognitive pipelines) remain intentional custom code.
- **No speculative layering** — Do not introduce abstractions, extension points, or parallel APIs for **unused or imagined** needs; add structure when a second real consumer exists, not when imagining one. This bounds **Right path over minimal diff**: end-state correctness ≠ inventing unused seams.
- **Portal shell = Tauri** — Shell host is **Rust** (Tauri); do **not** bundle a Node sidecar for companion. Habitat / features stay TypeScript. Rules → [`.agent/rules/tauri-shell.md`](.agent/rules/tauri-shell.md).

---

## Startup order

1. [GitHub Issues](https://github.com/freeanima-org/freeanima/issues) — actionable tasks and discussions
2. [Product design principles](#product-design-principles) — what to build and how to present it
3. [Code implementation principles](#code-implementation-principles) — how to shape changes
4. [`docs/product/architecture.md`](docs/product/architecture.md) — read before changing architecture / memory / credentials
5. Open matching files in [`.agent/rules/`](.agent/rules/README.md) per task (see doc map below)

---

## Common commands

日常优先 `just`（见根 [`Justfile`](Justfile) + [`just/`](just/) 模块；`just --list` / `just pack --list`）。根 [`package.json`](package.json) **仅** `prepare`（husky）；业务入口不走 `bun run`。Windows 源码开发（winget / Git Bash / Docker）：[`docs/ops/windows-dev.md`](docs/ops/windows-dev.md)（Justfile 需要 PATH 上的 `bash`）。

```bash
bun install
just                         # 交互选配方
just --list                  # 顶层：dev / check / pack / qa / …
just dev                     # Habitat（≥10000）+ Web（:5000）；多 worktree 友好
just dev habitat / just dev web / just dev tauri / just dev tauri-android
just check                   # PR 前质量门禁（= just qa check；≠ 全量 CI）
just fmt / just test         # 顶层短别名 → qa::
just qa typecheck / just qa lint / just qa test-changed
just db generate / just db migrate   # 需 DATABASE_URL
just pack web / just pack cli / just pack tauri-linux / just pack tauri-windows / just pack tauri-android
just install cli / just install tauri-linux -- --apt
just misc memory-sample -- --habitat-url http://127.0.0.1:<habitat> --stage full

# standalone 安装版 CLI（源码 tree 的 anima 无 service）
# anima service …
```

- Habitat API（**生产**）：`http://127.0.0.1:2658/rpc/v1`（standalone `anima service`；有 dist 时托管 `/web/*`）
- Habitat API（**源码 / just dev habitat**）：默认随机 **≥10000**（避开 2658/2659）；多 worktree 并行友好
- Web 形态：standalone / 源码部署须先有 `just pack web`（打包时强制；源码部署手动）；dev 用 `just dev` / `just dev habitat` + `just dev web`（HMR，不依赖落盘）
- 桌面/移动/浏览器开发客户端：聊天室 + 管理台 UI 在 `src/portal/app/tauri`（Portal）与 `src/portal/app/web`（浏览器调试）
- Dev UI：`just dev web` → `http://127.0.0.1:5000/web/chat`（若 `http.tls`/`DEV_HTTPS` 则为 `https://…`；Habitat：`/web/habitat/dashboard`）；浏览器默认 Habitat = **页面 origin**（Vite `/rpc` proxy；legacy `/rpc` 至 0.9.3）；`just dev habitat` 自动写入 `~/.anima/dev-web.token` 供 Vite 注入 token；dev-habitat **不托管** dist（UI 走 Vite）
- 开发 TLS：若 `http.tls.enabled` / `DEV_HTTPS=1`，由 **Vite HTTPS** 终止（复用 `~/.anima/tls`），Habitat 仅明文（`skipTls`）；与 `http` 覆盖对称
- Release: [`.agent/rules/release.md`](.agent/rules/release.md)
- PG ops (install, backup): [`docs/ops/database.md`](docs/ops/database.md)
- Remote access (Service API Token / LAN): [`docs/ops/remote-access.md`](docs/ops/remote-access.md)

---

## Doc map

| File                                                                                 | Role                                                                              |
| ------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------- |
| [`AGENTS.md`](AGENTS.md)                                                             | Bootstrap protocol, product & code principles (this file)                         |
| [`.agent/rules/`](.agent/rules/README.md)                                            | Implementation constraints (layers, tests, coding, DB, packages)                  |
| [GitHub Issues](https://github.com/freeanima-org/freeanima/issues)                   | Actionable tasks and discussions                                                  |
| [`docs/product/architecture.md`](docs/product/architecture.md)                       | Architecture principles and direction                                             |
| [`docs/cognition/environment-awareness.md`](docs/cognition/environment-awareness.md) | Environment + health baseline (session prompt + change notify)                    |
| [`docs/product/anima-uri.md`](docs/product/anima-uri.md)                             | Anima URI（entity 定位 / overlay；id 入库、URI 在 UI）                            |
| [`.agent/rules/repository-topology.md`](.agent/rules/repository-topology.md)         | Repo layout Phase 1 host/client；ui-kit∥shared；i18n site/ui/host                 |
| [`docs/cognition/temporal-summary.md`](docs/cognition/temporal-summary.md)           | Objective time digests (day/month/year; peer rollup)                              |
| [`docs/product/`](docs/product/)                                                     | Product framing (architecture, identity, entity model)                            |
| [`docs/cognition/`](docs/cognition/)                                                 | Cognitive mechanisms (memory, sleep, self layer, etc.)                            |
| [`docs/ui/`](docs/ui/overview.md)                                                    | UI/UX design system (dimensions, foundations, components, patterns)               |
| [`docs/aspects/`](docs/aspects/)                                                     | Cross-cutting design planes (data plane, offline, refresh, notification/reminder) |
| [`docs/modules/`](docs/modules/)                                                     | Product capability modules (chat, companion, skills, project, subagent, …)        |
| [`docs/ops/`](docs/ops/)                                                             | Deploy, secure, connect Habitat                                                   |
| [`docs/ops/habitat-rpc.md`](docs/ops/habitat-rpc.md)                                 | Habitat RPC transport + remote tool registration                                  |
| [`docs/tools/`](docs/tools/)                                                         | Built-in ToolSets (browser, execute-code, freeanima_docs, …)                      |

---

## Principle & direction maintenance

Corrections or refinements to direction, principles, philosophy, or agent behavior norms **must not live only in code or conversation**. Code remains SSOT for behavior, but agent-readable principles must be written to disk in the same task/PR.

### Triage

| Change nature                                                       | Where to write                                                                                                            | Examples                                                  |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| Product / cognitive architecture, long-lived design direction       | [`docs/product/architecture.md`](docs/product/architecture.md) → topic doc when needed (`memory.md`, `identity.md`, etc.) | Four-layer model, memory pipeline principles              |
| UI/UX design system (visual, components, interaction patterns)      | [`docs/ui/`](docs/ui/overview.md) — Agent hard bans stay in `.agent/rules/frontend-ui.md` / `ui-dimensions.md`            | Dimensions, DataListRow, foundations                      |
| Agent implementation constraints (coding, testing, layers, release) | [`.agent/rules/*.md`](.agent/rules/README.md) — matching topic file                                                       | Drizzle query conventions, layer deps, test mock strategy |
| Bootstrap summary, high-level principles, doc-map-level changes     | [`AGENTS.md`](AGENTS.md) — keep brief; link to detail docs                                                                | New product/code principle, conflict-priority adjustment  |

### Triggers

- User or maintainer explicitly corrects or refines a principle in conversation
- Code implements a principle that contradicts or extends existing docs
- Issue or PR changes architecture direction or expected agent behavior

### Agent checklist

- Principle change and doc diff land in the **same PR** (or same commit batch) — not "code now, docs later"
- After editing `.agent/rules/`, check whether a new implementation constraint belongs in `.agent/rules/` only, or also warrants a one-line update under [Code implementation principles](#code-implementation-principles)
- After editing `docs/product/` or `docs/cognition/`, check whether `AGENTS.md` doc map and conflict priority remain accurate

---

## Conflict priority

1. **Code implementation** > all docs
2. **`docs/product/architecture.md`** > other `docs/**/*.md`
3. **GitHub Issues** > architecture direction planning

When sources conflict: **implemented behavior** follows code (and topic docs that match code, e.g. [`sleep.md`](docs/cognition/sleep.md) for sleep scheduling). **Open enhancement Issues** may describe future direction that overrides stale planning prose but not shipped code.

## Docs to update when code changes

| Change type                                                | Update                                                                                                                                                                                             |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PG schema / DDL                                            | [`src/host/core/db/schema/`](src/host/core/db/schema/) + [`.agent/rules/coding.md`](.agent/rules/coding.md) — **include data backfill in the same migration SQL when dropping or renaming tables** |
| PG query conventions (ORM vs execute)                      | [`.agent/rules/drizzle-db.md`](.agent/rules/drizzle-db.md) — queries in `src/host/core/db/pg/`; capabilities use `@freeanima/host/core/db/pg/*` directly (no `engine.repos`)                       |
| PG ops (install, backup, migrate UX)                       | [`docs/ops/database.md`](docs/ops/database.md) · [`docs/ops/remote-access.md`](docs/ops/remote-access.md) for Token / LAN                                                                          |
| Layer deps / composition root / Registry                   | [`.agent/rules/code-layers.md`](.agent/rules/code-layers.md)                                                                                                                                       |
| Test strategy / mock tiers                                 | [`.agent/rules/testing.md`](.agent/rules/testing.md) + [`tests/README.md`](tests/README.md)                                                                                                        |
| Memory pipeline / retrieval                                | [`docs/cognition/memory.md`](docs/cognition/memory.md) + architecture                                                                                                                              |
| Security / threat surface                                  | [`docs/ops/security.md`](docs/ops/security.md) + architecture                                                                                                                                      |
| Architecture principles                                    | [`docs/product/architecture.md`](docs/product/architecture.md)                                                                                                                                     |
| Principle / direction / philosophy correction (any source) | Triage per [Principle & direction maintenance](#principle--direction-maintenance); same PR as code                                                                                                 |
| New RFC package / rename                                   | [`.agent/rules/packages.md`](.agent/rules/packages.md)                                                                                                                                             |
| Release                                                    | [`.agent/rules/release.md`](.agent/rules/release.md)                                                                                                                                               |
| Portal 壳（Tauri）打包 / ShellApi / 双轨发版               | [`.agent/rules/tauri-shell.md`](.agent/rules/tauri-shell.md)                                                                                                                                       |
| UI/UX design system / interaction patterns                 | [`docs/ui/`](docs/ui/overview.md) + [`.agent/rules/frontend-ui.md`](.agent/rules/frontend-ui.md) / [`ui-dimensions.md`](.agent/rules/ui-dimensions.md)                                             |
| Compression algorithm                                      | [`.agent/rules/compression.md`](.agent/rules/compression.md)                                                                                                                                       |
| UI / docs i18n (Paraglide, po4a, PO)                       | [`.agent/rules/i18n.md`](.agent/rules/i18n.md)                                                                                                                                                     |
| Task done                                                  | close corresponding GitHub Issue; user-visible changes use Conventional Commits                                                                                                                    |

Tool tables, module trees, API lists **are not maintained in docs** — use registration code and service router as source of truth.

## Maintenance conventions

- Principle / direction corrections: triage per [Principle & direction maintenance](#principle--direction-maintenance) — product framing → `docs/product/`; cognition → `docs/cognition/`; UI/UX → `docs/ui/`; implementation constraints → `.agent/rules/`; bootstrap summary → `AGENTS.md`
- New topic >50 lines and long-lived → `docs/` or `.agent/rules/`; actionable items → GitHub Issue
- Close Issue when task done; do not keep completed items in docs
- **docs layout** (optimized for `freeanima_docs` ToolSet path prefixes): product framing → `docs/product/`; cognition → `docs/cognition/`; UI/UX → `docs/ui/`; cross-cutting aspects → `docs/aspects/`; capability modules → `docs/modules/`; built-in ToolSets → `docs/tools/`; deploy/secure/connect → `docs/ops/`; IDE/agent implementation rules → `.agent/rules/` (not in docs corpus). No acceptance checklists in `docs/`.

## What each file must not contain

| File                         | Forbidden                                                                                    |
| ---------------------------- | -------------------------------------------------------------------------------------------- |
| AGENTS.md (this file)        | Full tool table, directory tree, API cross-ref, SemVer details, domain type inventory tables |
| `.agent/rules/*.md`          | Product architecture essays, weekly-changing tool lists                                      |
| docs/product/architecture.md | Concrete todos, weekly-changing tool lists                                                   |
| CHANGELOG.md                 | Manual add/remove of version sections or entries (Release Please maintains)                  |
