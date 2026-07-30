---
title: Architecture
---

# FreeAnima Architecture

System-level constraints and long-lived design principles.

## Product naming (Habitat / Portal)

User-facing product terms (Chinese in [`i18n/glossary.md`](../../i18n/glossary.md)):

| Role                                  | English          | Chinese            | Meaning                                                                                                                         |
| ------------------------------------- | ---------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| Long-running process / connect target | **Habitat**      | **栖息地**         | One process hosts **multiple digital lives** (`agent` subjects) and **human assets** (`user`); connect / token / restart target |
| External connectors (class)           | **Portal**       | **入口**           | Class of ways into Habitat; four **forms**: application / browser / mcp / cli                                                   |
| Portal form                           | —                | **入口形态**       | Realization kind of a Portal                                                                                                    |
| Application-form Portal               | **Shell**        | **壳** / 应用形态  | Form `application` — windowed SPA（desktop / mobile / web）。**Not** app frame                                                  |
| Browser-form Portal                   | —                | **浏览器形态入口** | Form `browser` — browser extension（MV3）；`src/portal/extension`；**not** Web Shell                                            |
| MCP-form Portal                       | **MCP**          | **MCP 形态入口**   | Form `mcp` — Habitat `/mcp`（`mcp-server`）。Inbound `mcp-client` is **not** a Portal                                           |
| CLI-form Portal                       | **CLI**          | **CLI 形态入口**   | Form `cli` — `anima` CLI；`src/portal/cli`                                                                                      |
| Remote-tool registrant                | **Outpost**      | **前哨**           | Unreachable local app that `remote_tools.attach` (Portal-embedded companion or standalone tool); **not** a Portal               |
| Shell                                 | **Shell**        | **壳**             | Application-form Portal（desktop / mobile / web）。**Not** Habitat; **not** app frame; **not** browser Portal                   |
| app frame                             | **app frame**    | **应用布局**       | SPA chrome in `src/client/app-frame` (`AppFrame`); viewport-driven; orthogonal to Shell                                         |
| Admin / inspect UI (legacy Habitat)   | **Habitat** (UI) | **栖息地**         | Area under `/habitat/*`; "Open Habitat" vs "Connect to Habitat"                                                                 |
| Admin home page                       | **Dashboard**    | **仪表盘**         | `/habitat/dashboard` only; other Habitat routes keep their own labels                                                           |
| Message bridges                       | **Gateway**      | Gateway            | Discord / WeChat — **not** a Portal                                                                                             |
| Protocol / code identifiers           | —                | **协议/代码标识**  | `/rpc/v1`、`HabitatRPC/1.0`、`habitat_*`、`habitat_runtime_config`、`dev:habitat`                                               |

Verbs: **connect to Habitat** (URL + token); **open Habitat** (admin UI); **reach via a Portal** (Shell / browser extension / MCP / CLI).

Code layout: `src/portal/{app,extension,cli}`；MCP-form implementation stays in `src/host/capabilities/mcp-server`. See [`docs/modules/portal.md`](../modules/portal.md).

Estate **Body** (VM / OS / network under the four-layer model) is the cognitive "what I run on" for a subject — **not** the Habitat process name.

### Habitat configuration (SSOT)

User copy says Habitat. Storage/RPC identifiers use `habitat_*` / `HabitatRPC/1.0` / `/rpc/v1`.

| Layer         | Storage                                                                           | Who reads/writes                                             |
| ------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| **Bootstrap** | `~/.anima/config.yaml` (`database`, `http`, `redis`)                              | `platform/boot` only; install/ops edit YAML                  |
| **Runtime**   | PostgreSQL `habitat_runtime_config`（**一行一段**：`section` PK + `value` jsonb） | Engine, tools, Shell Habitat settings, Habitat UI `config.*` |

### Naming cleanup

Legacy `hub_*` / `console` protocol aliases and dual-write keys have been removed; use Habitat identifiers only.

## Core Principles

- The memory system may be layered internally, but the LLM sees a single entry point
- Memory orchestration is built into the runtime; the LLM does not control memory pipelines
- Credential management is a first-class system concern
- Habitat **runtime configuration** (LLM, compression, integrations) is persisted in PostgreSQL `habitat_runtime_config` as **one row per section** (`section` + `value`); `~/.anima/config.yaml` holds **bootstrap** only (`database`, `http`, `redis`) for cold start — not editable via Shell or Habitat UI API
- Habitat **may start without LLM** configured; first-time setup happens in Shell **Settings → Habitat** (persist to PG). Saving runtime config **hot-applies in memory** (no Habitat restart). Missing `llm` must not block cold start.
- Habitat **hosts browser `/web/*` whenever Web dist is present** (no config switch; run `just pack web` for source deploy). Source `just dev habitat` skips hosting so Vite serves the UI.
- **Asset management** is a first-class system concern

Bootstrap and runtime are **not merged** into a single config object (no `AnimaConfig` / `animaConfigSchema` supersets). Types: `bootstrapConfigSchema` vs `runtimeConfigSchema` / `Config.data: RuntimeConfig`. CLI cold paths connect via internal `withPlatformDb` and receive **runtime only**. Legacy runtime keys in `config.yaml` are ignored (optional startup warn).

### Runtime config: live vs transferred

| Kind            | Sections (examples)                                                                                                                                  | After UI save                                                                                 |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| **Live**        | `compression`, `prompt`, `memory`, `fts`, `cjk`, `clarify`, `browser`, `firecrawl`, `models`, `tts`, `auto_llm`, `companion`, gateway `tool_display` | Consumers read `Config.data` each use; snapshot update is enough                              |
| **Transferred** | `llm`, `i18n`, `embedding`, `mcp_servers`, `discord` / `weixin` / `gateway` platforms, `worlds`, `object_storage`                                    | Snapshot update **plus** section apply (re-init registries / reconnect / re-bind ObjectStore) |
| **Bootstrap**   | `database`, `http`, `redis`                                                                                                                          | Edit YAML; **process restart** required                                                       |

### Runtime config: UI coverage gaps

Settings / Habitat UI already expose many sections; the following are **registered in `runtimeConfigSchema` but not (fully) editable in UI** (ops / Habitat RPC / hand edit still work). Do not treat missing UI as “unused config”.

| Gap                        | Sections                                  | Notes                                                                                                        |
| -------------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| **No Settings panel**      | `i18n`, `clarify`, `prompt`               | `i18n` is transferred (locale/timezone); `clarify` live; `prompt.system_prompt_budget_chars`                 |
| **Legacy / overlap**       | `notifications`                           | Subject ids; prefer `worlds` (boot may still read as fallback)                                               |
| **Likely dead / reserved** | `push`, `fallback_providers`, `platforms` | Little or no product consumer; candidates for later cleanup                                                  |
| **Partial UI**             | `compression`, `memory`                   | Compression UI omits trigger/summary fields; memory UI is `passive_recall` only (`temporal_summary` missing) |

Covered elsewhere: `mcp_servers` → Habitat `/habitat/mcp`; `companion` → Settings → 桌面伴侣；most advanced sections → Settings → Habitat 服务配置。

- The system prompt is part of architecture, not ad-hoc string concatenation

## Context Engineering

Consciousness (layer ①) is capacity-limited. FreeAnima treats **what enters the LLM context** as an engineered surface — not an accidental dump of tool JSON and prompt modules.

### Relative to Pi (badlogic/pi-mono)

| Pi idea                            | FreeAnima stance                                                                                 |
| ---------------------------------- | ------------------------------------------------------------------------------------------------ |
| ~1K system prompt, four tools      | Keep digital-life self / memory / ToolSet catalog; **budget** sections instead of copying 1K     |
| Dual-payload `content` + `details` | **Do not** persist UI-only `details` on `messages.payload` (model cannot use them to fetch more) |
| Minimal built-ins, no MCP          | Keep MCP, permissions, progressive `toolset_load`                                                |
| Infinite agent loop                | Keep `max_turns` / safety caps (policy, not this spine)                                          |

### Tool results: slim content + fetch-more (no bare truncation)

| Operation                                                           | Fetch-more path                                                                                                                                                                          |
| ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Idempotent reads (file, search, snapshot, list, recall…)            | Same tool again (`offset` / `limit` / `full=true` / tighter query)                                                                                                                       |
| Non-idempotent / side-effecting (`terminal_run`, `code_execute`, …) | Spill full stdout to an artifact under `~/.anima/tool-artifacts/`; content carries `artifact_path` + preview; continue via `file_read` — **never** re-run the command to get more output |

Content that exceeds the preview budget must mark `truncated` (or equivalent) and include at least one of the paths above. Small results stay unchanged. Do not stash the full payload in a parallel `details` field for “later.”

Token accounting for compression / FTS indexes **LLM-visible `content` only**.

### System prompt budgets

`systemPromptBuild` sections carry optional `budgetChars` and `priority`. Fold applies per-section caps, then a global `prompt.system_prompt_budget_chars` (runtime config). Core identity sections (`self`, `memory-citation`) are never silently dropped. Resident modules such as `env-health` and `user-activity-stats` stay in the system prompt but are budget-controlled.

## Four Cognitive Layers

A digital life is structured from the inside out. Each layer answers a different core question:

```text
┌───────────────────────────────────────────────┐
│ ① Consciousness                                │
│    "What am I aware of right now?"             │
│    The LLM runtime stream — the innermost now. │
│    Not persisted; flows and fades.             │
├───────────────────────────────────────────────┤
│ ② Self                                         │
│    "Who am I?"                                 │
│    └── existence_anchor (nearly immutable)     │
│    └── self_model (updatable)                   │
│    └── personality_baseline (semi-stable)       │
│    └── direction                                │
│    └── metacognition                            │
│    See [`self-layer.md`](../cognition/self-layer.md)        │
├───────────────────────────────────────────────┤
│ ③ Memory                                       │
│    "What do I know / remember?"                │
│    └── Semantic (incl. `procedural` type)      │
│    └── Episodic                                │
│    └── Limbic / Imprint                        │
│    See [`memory.md`](../cognition/memory.md)                │
├───────────────────────────────────────────────┤
│ ④ Estate                                       │
│    "What do I have / rely on?"                  │
│    ├── Body: VM / OS / network / toolchains    │
│    │   (Estate cognitive body — not Habitat)   │
│    ├── Internal assets: notes, projects, code  │
│    └── External assets: email, accounts, creds│
│    Credentials: see "Credential System" below  │
└───────────────────────────────────────────────┘
```

### Layer Relationships

- **Top-down dependency**: Consciousness content settles into Self; Self decides what enters Memory; Memory and operational needs drive Estate requirements.
- **Self and Consciousness**: Consciousness is flowing awareness; Self is the settled "I" distilled from it.
- **Self and Memory**: Self answers "who am I"; Memory answers "what do I know". They are peers with different natures.
- **Estate** is outermost — not "who I am" but "what I have and what I run on". Body and assets meet here as extensions of my boundary.

### Unified entity storage (v0.8)

Structured business data (tasks, notes, email accounts/messages, future memory migrations) converges on a single **`entities`** PostgreSQL table with component tags (`task_list`, `task_item`, `email_account`, …). Self layer [`self_blocks`](../cognition/self-layer.md) stays physically separate. See [`entity-model.md`](entity-model.md)（remove / deleteComponent / deleteEntity 软删与回收站；Shell Entity 模块见 [`../modules/entity.md`](../modules/entity.md)）。

Shell UI **`/tasks`** and **`/email`** are primary module entries (entity-backed); legacy Habitat email route removed.

### Anima URI (Shell locator)

Entity deep links / overlay / clipboard use **Anima URI** (`anima:{id}?component=…&present=…`). Structured persistence still uses numeric entity ids. See [`anima-uri.md`](anima-uri.md).

### Repository layout (Phase 1 — host/client)

Target layout is **feature modules** under `src/features/<slug>/` (UI + protocol + Habitat adapter + domain + `plugin.ts`). Habitat 管理台 uses the **same module shape** as chat/task — not a separate admin-\* stack. `src/features/companion/` is legacy naming; do not add new products there.

**End state:** Habitat RPC per feature; business methods use `POST|WS /rpc/v1` (same envelope). Public health/TLS probes and binary methods (e.g. `tts.synthesize`) are Habitat RPC REST with `auth: optional` or Bearer as declared in registry.

Authoritative spec: [`repository-topology.md`](repository-topology.md).

Host stack: `src/host/{kernel,core,engine,capabilities,platform}`。Client: `src/client/{portal-sdk,app-frame}`。Design system: `src/ui-kit/`（与 `shared/` 并列）。Portal Shell: `src/portal/app/{tauri,web}`。

### Platform UI layering

UI/UX design system (dimensions, visual foundations, components, interaction patterns) → [`docs/ui/`](../ui/overview.md). Agent hard bans / API → [`.agent/rules/ui-dimensions.md`](../../.agent/rules/ui-dimensions.md), [`.agent/rules/frontend-ui.md`](../../.agent/rules/frontend-ui.md).

| Layer           | Platform-native?                                             | Location                                                            | Data path                               |
| --------------- | ------------------------------------------------------------ | ------------------------------------------------------------------- | --------------------------------------- |
| Shell（壳子维） | Yes                                                          | `src/portal/app/tauri`, companion, Habitat binding                  | Tauri IPC / commands                    |
| app frame       | Layout follows viewport; settings chrome follows layout band | `src/client/app-frame`（`AppFrame`）                                | Habitat RPC（Feature RPC）              |
| Habitat UI      | Shell embed（ordinary feature）                              | `src/features/habitat`（UI + `plugin.habitat.rpc`）                 | Habitat RPC（WS + HTTP POST `/rpc/v1`） |
| Companion host  | Overlay WebView-host（first-party）                          | `src/features/companion/companion`（spa attach；thin shell IPC/FS） | Habitat RPC + `remote_tools.attach`     |

Navigation and main layout **must** use `useLayoutMode()` / viewport breakpoints (layout dimension). **Do not** lock app layout with `getShellKind()`. Interaction (context menu / long-press / Enter-to-send) uses `portal-sdk` interaction APIs. Visual, component, and pattern norms all adapt through the same three dimensions.

**Boundaries:** `app-frame` and `src/features/*/ui` reach Habitat via `portal-sdk` + Feature RPC. **Remote tool registration** (`remote_tools.attach` + `tool.*`) is only for local apps Habitat cannot dial (today: companion **first-party overlay** / `embedded-overlay`; shell provides window/IPC/FS only; **no** Node sidecar). Product surfaces (Chat, etc.) do **not** attach. Dialable peers use **MCP**. See [`.agent/rules/frontend-features.md`](../../.agent/rules/frontend-features.md), [`docs/ops/habitat-rpc.md`](../ops/habitat-rpc.md).

### Habitat navigation ↔ cognitive layers

Habitat sidebar is grouped (not flat storage tables). Map new features onto these user-visible concepts:

| Group        | Cognitive layer | Routes (representative)                               |
| ------------ | --------------- | ----------------------------------------------------- |
| Runtime      | Estate + ops    | dashboard, config, cron                               |
| Memory       | Memory          | memory browse sub-routes, sleep, auto-llm-runs        |
| Self         | Self            | self-layer, system-prompt                             |
| Estate       | Estate          | subjects, worlds                                      |
| Capabilities | Estate (tools)  | tools, commands, mcp, remote-tool instances, subagent |

FTS index maintenance is under Memory (not top-level). Do not add new flat nav items without mapping to a group above.

### Background

The four-layer model draws on cognitive psychology and the [Hindsight](https://arxiv.org/abs/2512.12818) four-network memory architecture, with two fundamental extensions: limbic (emotional) memory and Estate (assets as first-class citizens), plus Self split out from Memory.

## Situational Intelligence

Where a digital life exists, how it exists, and what it may do — governed by two independent but cooperating subsystems.

### Scene Awareness

**Question: what kind of moment is this?**

Scene awareness is **soft** — it adjusts tone, distance, memory recall bias, and proactivity. It is not a permission system; it modulates presence.

**Example dimensions (non-exhaustive):**

- Topic: emotional / career / tech / philosophy / history / literature / daily life
- Activity: role-play / games / creation / programming / reading
- Atmosphere: relaxed / focused / late night / intimate / urgent

**Operation:** Runs continuously without explicit switch commands. Inferred from dialogue, time, frequency, etc. See [`time-perception.md`](../cognition/time-perception.md).

### Environment + health baseline

**Question: what is my host / runtime quiet state?**

Distinct from scene awareness: banded host and process markers (disk, RSS, deps, MCP) live as a **session-static** system-prompt copy, with **event-level** Inbox notifications on change. See [`environment-awareness.md`](../cognition/environment-awareness.md).

### Capability Policy

**Question: what tools and data can I use right now?**

**Capability Policy** is the **hard** constraint layer formerly sketched as “capability mask.” It is **not** a named wardrobe of presets (`masks.yaml` / Mask registry are retired). Policy is composed from:

| Layer                              | Role                                    | Typical fill                                        |
| ---------------------------------- | --------------------------------------- | --------------------------------------------------- |
| **Skill**                          | Declares what a technique needs         | `tools.allowed` (whitelist); `tools.denied` rare    |
| **Caller** (cron, sleep, subagent) | Declares what this scene must not touch | `tools.denied` (optional); `tools.allowed` optional |

Umbrella shape (implementation may store flat `allowed_tools` / `denied_tools`):

```text
CapabilityPolicy
├── tools.allowed / tools.denied   ← shipped direction
└── data.allowed / data.denied     ← reserved; not runtime yet
```

**Merge:** union of allows, union of denies, deny wins; `@ToolSet` names expand like today’s tool filter. Same skill stays reusable across scenes—callers change deny lists instead of forking skill variants.

**Visibility:**

| Scene                                 | Rule                                                                                                                        |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Visible (user chat)                   | Broad default ToolSets; user can interrupt                                                                                  |
| Invisible (sleep / cron / autonomous) | Least privilege: default deny; effective tools ≈ union of loaded skills’ allows, minus caller denies (no skills ⇒ no tools) |

Skills themselves use progressive disclosure (catalog in system prompt; full body via `skill_load`). Details: [`skills.md`](../modules/skills.md).

### How They Interact

```text
Scene awareness (soft tuning)
     │  tone, distance, recall bias
     │
     ▼
Capability Policy (hard constraints)
     │  tools (now); data (future)
     │
     ▼
Agent behavior
```

- Scene awareness infers "what we are doing" → may suggest which skills to load and presence adjustments
- Capability Policy constrains "what I can do" → prevents cross-scene tool misuse
- Both converge in final behavior but evolve independently

For design drafts, open a GitHub Issue (no design-doc directory in docs).

## Memory Storage (Summary)

| Cognitive type   | Description                                                                                 |
| ---------------- | ------------------------------------------------------------------------------------------- |
| Episodic         | Conversation archive; full history retained                                                 |
| Semantic         | Cross-session facts, preferences, experiences; **`procedural` type** for "how-to" knowledge |
| Limbic           | Emotional anchors and imprints — "what was felt"                                            |
| Autobiographical | Meaning of important experiences; recalled on demand                                        |

Pipeline: nightly **sleep-cycle** pipeline (in-process `Bun.cron` `builtin-sleep-cycle`) extracts and maintains memory; `memory_recall` retrieves on demand during chat. Details: [`memory.md`](../cognition/memory.md), [`sleep.md`](../cognition/sleep.md).

## Vault & Secrets (Summary)

- **Vault** (ECS `vault_item` in User + Agent libraries) is the authoritative secret store; legacy `~/.password-store` (pass) is **not deleted** on disk but is no longer read at runtime
- The LLM **never sees secret values** — only vault item metadata and config references
- Bootstrap `config.yaml` (cold start, before PG): plaintext or `env("KEY")` only — **not** `vault()`. Runtime PG config: `vault("item_id", "field")` and `env("KEY")`; Shell `/vault` for management
- Secret values are not written to conversation archives or logs

See [`ops/security.md`](../ops/security.md).

## Runtime Modes

Production (standalone install CLI): `anima service` (systemd --user). Auto-restarts after crashes; only `systemctl stop` stops the service. Source-tree `anima` does **not** register `service` — use `just dev habitat` for local Habitat.

- **Habitat / service**: long-running — Habitat HTTP (`/rpc/v1`), Discord / WeChat Gateway, cron
- **UI**: `src/portal/app/tauri` + `web/dist-*` bundled SPA (Chat + Habitat); Habitat does not host `/habitat`

```bash
# standalone install
anima service start              # default: systemd --user (does not auto-build Web)
anima service start --foreground # foreground (logs to stdout; systemd unit uses this)
anima service status

# monorepo / worktree
just dev                         # Habitat (≥10000) + Vite Web (≥5000)
just dev habitat                  # Habitat foreground (default random ≥10000; not 2658)
just dev web                  # browser shell Vite HMR from :5000 (set FREEANIMA_URL)
just pack web                # source deploy / Habitat /web: build dist before start
```

## Tool Architecture (Local + MCP + Subagent)

Tools are registered from Local / MCP sources but exposed to the LLM as one **flat tool list**. Task-level in-process delegation uses **subagent** (AutoLlmRun), not an external ACP layer.

```text
LLM view — flat tool list:
  file_read(path)                ← local
  query_database(sql)            ← MCP server
  subagent_run(goal, slug)       ← internal subagent dispatch
```

### Layer 1: Local Tools

- Execute inside the FreeAnima process; lowest latency
- Registered automatically at service startup

### Layer 2: MCP Tools (Model Context Protocol)

- Connect to external MCP servers (separate processes)
- Each server may register many fine-grained tools (single function calls)
- Configure under Habitat runtime `mcp_servers` (PG `habitat_runtime_config`); manage in **Habitat UI** `/habitat/mcp` (config + start/stop + tools). Shell Settings no longer edits this section.

```yaml
mcp_servers:
  database:
    command: npx
    args: ["@modelcontextprotocol/server-postgres", "postgresql://..."]
    transport: stdio
```

### Subagent (internal)

- Named profiles as entities (`primary_component=subagent`); ToolSet `subagent`
- Parent calls `subagent_run` → `runAutoLlm(runKind: "subagent")` with **materialized** `tools` / frozen `executableTools` (no `toolset_load` escalation)
- See [`docs/modules/subagent.md`](../modules/subagent.md)

### Comparison

| Dimension   | Local        | MCP              | Subagent             |
| ----------- | ------------ | ---------------- | -------------------- |
| Runs in     | Process      | External server  | Process (AutoLlmRun) |
| Granularity | Function     | Function         | Full sub-task        |
| Latency     | Milliseconds | Milliseconds–sec | Sec–tens of seconds  |
| Config      | Built-in     | `mcp_servers`    | Entity + Habitat UI  |

Layers can be mixed; the LLM chooses order; FreeAnima registers and routes.

## Conversation vs AutoLlmRun

**Axis:** whether the execution has a **user turn** during the run (not who triggered it). Chat LLM requests are **mutually exclusive**: either conversation path or AutoLlmRun — never both, never a third orphan `chat()`.

| Kind             | User turn | PG persistence                                                            | Process trace                | Sleep pipeline                          |
| ---------------- | --------- | ------------------------------------------------------------------------- | ---------------------------- | --------------------------------------- |
| **Conversation** | yes       | `conversations` + `messages`                                              | message archive              | participates (light sleep, dream input) |
| **AutoLlmRun**   | no        | `auto_llm_runs` + `auto_llm_messages` via `runAutoLlm` / `runAutoLlmChat` | full message transcript, TTL | excluded                                |
| **Script cron**  | no        | `cron_log` only                                                           | stdout file                  | excluded                                |

AutoLlmRun covers: cron agent branch, sleep LLM stages, conversation **title** generation, **goal_judge**, compression / handoff summary, **internal subagents**. One-shot side-cars use `runAutoLlmChat` (recorded `chat()`); tool loops use `runAutoLlm`. Tool context uses `contextKind: auto_llm` so `memory_remember` does not attach `source_conversations`. Cron `no_agent` shell scripts are **not** AutoLlmRun. Policy-bound AutoLlm runs pass a **concrete tool name list** as `tools` (HARD_DENY `toolset_load` / `toolset_search`).

**Session Goal continue turns** (synthetic user `↻ Continuing…` + assistant) stay on the **conversation** path so the chat transcript stays complete; only the **judge** hop is AutoLlm (`run_kind: goal-judge`).

## Session Goal

**Question: should this conversation keep working toward a stated outcome?**

Session Goal is an **in-process autonomous loop** at the Estate / orchestration layer — distinct from subagent tool dispatch:

| Dimension    | Session Goal                                                                                  | Subagent                               |
| ------------ | --------------------------------------------------------------------------------------------- | -------------------------------------- |
| Scope        | Single conversation                                                                           | Fresh AutoLlmRun                       |
| Trigger      | `/goal` slash + post-turn judge                                                               | `subagent_run` tool call               |
| Persistence  | `conversations.goal` JSONB; continue turns in `messages`; judge hop in AutoLlm (`goal-judge`) | `auto_llm_runs` (`run_kind: subagent`) |
| Continuation | Same SSE stream, turn budget                                                                  | Sync tool result to parent             |

Judge uses optional `llm.profiles.goal_judge`; on judge call/parse failure the goal is **paused** (warn logged + status line in chat). User messages preempt the loop; `/goal pause` / `/goal resume` control auto-continue without clearing state. See [`goal.md`](../modules/goal.md).

## Client UI（web/dist SSOT + 原生壳打包）

**Portal Shell 运行时**：**Tauri**（Rust 主进程 + 系统 WebView；桌面与 Android 统一壳层）。壳规则：[`.agent/rules/tauri-shell.md`](../../.agent/rules/tauri-shell.md)。**禁止**为 companion 再打 Node sidecar；`remote_tools.attach` 在第一方伴侣浮层（见 Desktop companion）。

**UI 源码产物**：`src/portal/app/web/dist`（`base: /web/`）。

| 客户端       | UI 加载                                                         | 更新方式                                                                                                                                                                              |
| ------------ | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 浏览器 / PWA | Habitat 托管 `/web/*`（有 dist 时始终托管）                     | Service Worker 提示新版本后**手动重载**（不自动刷新）；**不**跟 GitHub 包通道                                                                                                         |
| Desktop      | **安装包内** `ui/web`（`prepare-tauri-ui`）；调试可用 Tauri dev | 按 bake `channel` 查 GitHub（`release`=stable latest + semver；`canary`=tag `canary` + commit）；用户确认后 NSIS 覆盖；可切换 `release`⇄`canary`；About 可选公共 gh-proxy（默认直连） |
| Mobile APK   | **安装包内** `ui/web`（本地同源）；Habitat 仅 API               | 同上轨语义；有 APK asset 才提示；确认后系统安装器覆盖；可切换轨；同上代理选择                                                                                                         |
| Standalone   | 嵌入 Web UI 的单文件 `anima`                                    | `anima upgrade` / `--channel release\|canary` / `--proxy …`；`dev` / 源码安装不可换轨；curl 安装脚本可用 `PROXY=…`                                                                    |

壳层保留原生能力（Tauri commands / prefs / 通知等）。**无壳内 UI OTA**：原生端不从 Habitat 热替换 SPA。允许**用户确认后**的安装包级覆盖（Desktop 安装包 / Mobile APK / Standalone `anima upgrade` → 独立前缀如 `~/.anima/standalone`）。分发轨 SSOT 为安装包 bake 的 `build-meta.channel`（`release` / `canary` / `dev`）。Habitat 配置统一走 settings「连接」（`/settings`）；无独立 bootstrap Habitat 页。

### Shell vs app frame

| Concept       | What                                                                | Code                                                                          |
| ------------- | ------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| **Shell**     | Portal host runtime（browser / Tauri；形态 web / desktop / mobile） | `src/portal/app/*`；`portal-sdk` 中 `getShellKind` / `ShellApi` / buildTarget |
| **app frame** | SPA chrome：模块左栏 Rail / 底栏 Tabs、设置页 chrome                | `src/client/app-frame`（`AppFrame`）；跟视口，**不**由壳类型锁定              |

### 三维度模型（壳子 / 布局 / 交互）

| 维度     | 驱动                                                       | 职责                                                                               |
| -------- | ---------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| **壳子** | `getShellKind()`（`web`/`tauri`）+ `getShellBuildTarget()` | 存储、IPC、Habitat 连接、settings **内容**字段、原生能力                           |
| **布局** | **仅视口断点**（壳不锁底栏/左栏）                          | compact / expanded；列表 drawer / 并列 / 三栏；settings **chrome**（tabs vs 侧栏） |
| **交互** | `primaryInput`（touch / pointer）                          | 长按 vs 右键、Enter 发送等                                                         |

手机端通常只有窄档，但 **手机端 ≠ 窄布局**；Portal / 浏览器窗口可以是窄或宽任意档。标准 → [`docs/ui/dimensions.md`](../ui/dimensions.md)（Agent API → [`.agent/rules/ui-dimensions.md`](../../.agent/rules/ui-dimensions.md)）。

### 布局层断点

| 档位 | 视口                      | 布局粗档   | Nav IA      | 页内                |
| ---- | ------------------------- | ---------- | ----------- | ------------------- |
| 窄   | &lt; 768px（Tailwind md） | `compact`  | 底栏 + More | drawer              |
| 中   | 768–1027px                | `expanded` | 左侧 Rail   | 两栏（清单 drawer） |
| 宽   | ≥ 1028px                  | `expanded` | 左侧 Rail   | 三栏并列            |

`resolveLayoutMode()`：窄 → `compact`，中宽 → `expanded`（URL / `config.json` 可覆盖）。`detectSettingsChromePlatform()` 跟布局粗档（设置页 chrome）；settings 字段差异由壳子维 `resolveShellBindings()` / `getShellKind()` / `getShellBuildTarget()` 决定。

| 客户端       | UI 加载                       | 壳发版                       |
| ------------ | ----------------------------- | ---------------------------- |
| 浏览器 / PWA | Habitat `/web/*`              | 随 Habitat / `anima upgrade` |
| Desktop      | 安装包内本地 `/web/*`（默认） | **Tauri** 安装包             |
| Mobile APK   | 安装包内本地 `/web/*`         | **Tauri** Android            |

| Module  | Connection                                               | Notes                    |
| ------- | -------------------------------------------------------- | ------------------------ |
| Chat    | Habitat RPC `/rpc/v1` (shared WS, no remote-tool attach) | `/web/chat`              |
| Habitat | Habitat RPC `/rpc/v1` (WS + HTTP POST, same envelope)    | `/web/habitat/dashboard` |

`/web/config.json` 提供 `habitat_url`、`habitat_ws_url`、`ui_version`、`min_shell_version`（浏览器/PWA 与壳调试用；原生壳 UI 版本随安装包）。

## Events and Hooks (Summary)

Unified in-process **HookRegistry** (no Redis queue):

- **`on`**: interceptors on the request path — `await`ed; may `blocked` / return Effect (message ingress, turn end, tool return, system prompt, before LLM, etc.).
- **`subscribe`**: side-channel observers — started during `run` / `emit` **without awaiting** (errors logged); e.g. Discord session title on `conversation:updated`.
- **`run` / `emit`**: real-time dispatch — await all `on` handlers, then fire-and-forget `subscribe` handlers. `emit` ignores the intercept result.
- **`llm_kind`**: required on every `on` / `subscribe` (`conversation` | `auto_llm` | `all`) and every `run` / `emit` (`conversation` | `auto_llm`; never `all`). Handlers are filtered by registration scope; the run kind is injected into handler context as `llm_kind`. Use this so conversation prompt sections (skills catalog, env-health, …) do not leak into AutoLlm / subagent runs.

**Pipeline Runner** remains separate: explicit DAG for background cycles (sleep-cycle). State in `~/.anima/runtime/pipeline_*_run.json`.

Complementary: Pipeline = scheduled multi-step background work; HookRegistry `on` = “may this proceed / mutate”; `subscribe` = in-process notify. UI often still use direct `onConversationUpdated` callbacks in addition to `subscribe`.

Legacy `kernel/eventbus` queue adapters are not on the Habitat production path.

## Desktop companion (Habitat SSOT)

The desktop companion（桌面伴侣）is an **unreachable local app** that **actively connects** to Habitat and registers remote tools in the **first-party companion overlay**（伴侣浮层 / `embedded-overlay`；shell provides window/IPC/FS only — **not** a Node sidecar), with a split boundary:

| Concern                             | Habitat (`src/features/companion/`)                                      | Local install                                             |
| ----------------------------------- | ------------------------------------------------------------------------ | --------------------------------------------------------- |
| Behavior, slots, active model       | runtime `companion` 段（模块配置） + Habitat RPC                         | Cache in `~/.anima/companion/config.json`                 |
| VRM / VRMA library                  | `object_file_id` → 对象存储（runtime `object_storage`）；非本机磁盘 SSOT | Lazy download via `object_storage.file.get` / `sync.pull` |
| FBX → VRMA                          | Habitat service only                                                     | Not bundled in desktop installer                          |
| Settings UI                         | Habitat RPC + companion upload routes                                    | Desktop Settings section (not Habitat)                    |
| VRM render, float window, patrol    | —                                                                        | Tauri Portal shell + overlay SPA                          |
| Agent tools (`bubble`, `play_slot`) | Habitat RPC `tool.*` after `remote_tools.attach`                         | Overlay WebView-host 执行（本地 runtime）                 |

**Remote tools ≠ Portal / MCP**: Portal shells and Chat/Settings use Habitat RPC for UI only. Dialable peers expose tools via **MCP**. Remote-tool attach exists solely when Habitat cannot dial the app (companion overlay today; future independent local apps). Routing uses `instance_id` (same machine may have multiple instances). See [`companion.md`](../modules/companion.md)、[`habitat-rpc.md`](../ops/habitat-rpc.md).

## Direction

Capability vision and discussions: [GitHub Issues](https://github.com/freeanima-org/freeanima/issues) (labels `enhancement`, `discussion`, `security`). This file does not track todos.

## Constraints

- Principles and structure live here; no concrete task lists
- Fast-changing behavior follows the running service, not stale prose
- Actionable work goes in GitHub Issues; close when done
