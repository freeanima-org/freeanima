---
title: Architecture
---

# FreeAnima Architecture

System-level constraints and long-lived design principles.

## Product naming (Habitat / Portal)

User-facing product terms (Chinese in [`i18n/glossary.md`](../../i18n/glossary.md)):

| Role                                  | English          | Chinese           | Meaning                                                                                                                         |
| ------------------------------------- | ---------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Long-running process / connect target | **Habitat**      | **栖息地**        | One process hosts **multiple digital lives** (`agent` subjects) and **human assets** (`user`); connect / token / restart target |
| External connectors (class)           | **Portal**       | **入口**          | Shell, MCP clients, and similar ways in; not the Habitat itself                                                                 |
| Shell                                 | **Shell**        | **壳**            | A Portal (desktop / mobile / web window; SSH-like)                                                                              |
| Admin / inspect UI (legacy Habitat)   | **Habitat** (UI) | **栖息地**        | Area under `/habitat/*`; "Open Habitat" vs "Connect to Habitat"                                                                 |
| Admin home page                       | **Dashboard**    | **仪表盘**        | `/habitat/dashboard` only; other Habitat routes keep their own labels                                                           |
| Message bridges                       | **Gateway**      | Gateway           | Discord / WeChat — **not** a Portal                                                                                             |
| Protocol / code identifiers           | —                | **协议/代码标识** | `/rpc/v1`、`HabitatRPC/1.0`、`habitat_*`、`habitat_runtime_config`、`dev:habitat`                                               |

Verbs: **connect to Habitat** (URL + token); **open Habitat** (admin UI); **reach via a Portal** (Shell / MCP).

Estate **Body** (VM / OS / network under the four-layer model) is the cognitive "what I run on" for a subject — **not** the Habitat process name.

### Habitat configuration (SSOT)

User copy says Habitat. Storage/RPC identifiers use `habitat_*` / `HabitatRPC/1.0` / `/rpc/v1`.

| Layer         | Storage                                                     | Who reads/writes                                             |
| ------------- | ----------------------------------------------------------- | ------------------------------------------------------------ |
| **Bootstrap** | `~/.anima/config.yaml` (`database`, `http`, `redis`, `web`) | `platform/boot` only; install/ops edit YAML                  |
| **Runtime**   | PostgreSQL `habitat_runtime_config`                         | Engine, tools, Shell Habitat settings, Habitat UI `config.*` |

### Naming cleanup

Legacy `hub_*` / `console` protocol aliases and dual-write keys have been removed; use Habitat identifiers only.

## Core Principles

- The memory system may be layered internally, but the LLM sees a single entry point
- Memory orchestration is built into the runtime; the LLM does not control memory pipelines
- Credential management is a first-class system concern
- Habitat **runtime configuration** (LLM, compression, integrations) is persisted in PostgreSQL (`habitat_runtime_config`); `~/.anima/config.yaml` holds **bootstrap** only (`database`, `http`, `redis`, `web`) for cold start — not editable via Shell or Habitat UI API
- Habitat **may start without LLM** configured; first-time setup happens in Shell **Settings → Habitat** (persist to PG), then restart Habitat so registries rebuild. Missing `llm` must not block cold start.
- Whether Habitat hosts browser `/web/*` is **`config.yaml` `web.enabled`** (bootstrap; absent defaults to on when dist exists). Do not put this switch in PG — empty runtime would otherwise block the Settings UI that configures that runtime.
- **Asset management** is a first-class system concern

Bootstrap and runtime are **not merged** into a single config object. CLI cold paths connect via internal `withPlatformDb` and receive **runtime only**. Legacy runtime keys in `config.yaml` are ignored (optional startup warn).

- The system prompt is part of architecture, not ad-hoc string concatenation

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
│    └── autobiography_summary (append-only)      │
│    See [`self-layer.md`](self-layer.md)        │
├───────────────────────────────────────────────┤
│ ③ Memory                                       │
│    "What do I know / remember?"                │
│    └── Semantic (incl. `procedural` type)      │
│    └── Episodic                                │
│    └── Limbic / Imprint                        │
│    See [`memory.md`](memory.md)                │
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

Structured business data (tasks, notes, email accounts/messages, future memory migrations) converges on a single **`entities`** PostgreSQL table with component tags (`task_list`, `task_item`, `email_account`, …). Self layer [`self_blocks`](self-layer.md) stays physically separate. See [`entity-model.md`](entity-model.md).

Shell UI **`/tasks`** and **`/email`** are primary module entries (entity-backed); legacy Habitat email route removed.

### Anima URI (Shell locator)

Entity deep links / overlay / clipboard use **Anima URI** (`anima:{id}?component=…&present=…`). Structured persistence still uses numeric entity ids. See [`anima-uri.md`](anima-uri.md).

### Repository layout (Phase 0 — revised)

Target layout is **feature modules** under `src/features/<slug>/` (UI + protocol + Habitat adapter + domain + `plugin.ts`). Habitat uses the **same module shape** as chat/task — not a separate admin-\* stack. `src/satellites/` is legacy naming; do not add new products there.

**End state:** Habitat RPC per feature; business methods use `POST|WS /rpc/v1` (same envelope). Public health/TLS probes and binary methods (e.g. `tts.synthesize`) are Habitat RPC REST with `auth: optional` or Bearer as declared in registry.

Authoritative spec: [`repository-topology.md`](repository-topology.md).

Engine stays horizontal: `src/kernel/`, `src/core/`, `src/runtime/`, `src/platform/` (boot + routers). Shell host: `src/frontend/` (`ui-kit`, `shell-sdk`, `shell-ui`).

### Platform UI layering (legacy paths — migrating to features/\*)

| Layer            | Platform-native?                   | Location (current → target)                           | 数据通道                                |
| ---------------- | ---------------------------------- | ----------------------------------------------------- | --------------------------------------- |
| Shell（壳子维）  | Yes                                | `src/app/shell/tauri`, companion, Habitat binding     | Tauri IPC / commands                    |
| Shared SPA shell | 布局跟视口；设置 chrome 跟布局粗档 | `src/frontend/shell-ui`                               | Habitat RPC（Feature RPC）              |
| Habitat 前端     | Shell embed                        | `src/features/habitat`（UI + `plugin.habitat.rpc`）   | Habitat RPC（WS + HTTP POST `/rpc/v1`） |
| Companion host   | Overlay WebView-host（第一方）     | `src/satellites/companion`（spa attach；壳薄 IPC/FS） | Habitat RPC + `remote_tools.attach`     |

导航与主布局**必须**用 `useLayoutMode()` / 视口断点（布局维），**禁止**用 `getShellKind()` 锁 Shell 布局。交互（右键/长按/Enter）用 shell-sdk 交互 API。三维度标准 → [`.agent/rules/ui-dimensions.md`](../../.agent/rules/ui-dimensions.md)。

**边界**：`shell-ui` 与 `src/features/*/ui` 通过 `shell-sdk` + Feature RPC 访问 Habitat。**远程工具注册**（`remote_tools.attach` + `tool.*`）仅用于 Habitat 拨不到的本地应用（今日 companion：**第一方 overlay WebView-host** 内 attach；壳只提供窗/IPC/FS；**禁止** Node sidecar）。产品面（Chat 等）**不做** attach。可拨号对端的工具走 **MCP**。详见 [`.agent/rules/frontend-features.md`](../../.agent/rules/frontend-features.md)、[`docs/guide/habitat-rpc.md`](../guide/habitat-rpc.md)。

### Habitat navigation ↔ cognitive layers

Habitat sidebar is grouped (not flat storage tables). Map new features onto these user-visible concepts:

| Group        | Cognitive layer | Routes (representative)                          |
| ------------ | --------------- | ------------------------------------------------ |
| Runtime      | Estate + ops    | dashboard, config, cron                          |
| Memory       | Memory          | memory browse sub-routes, sleep, auto-llm-runs   |
| Self         | Self            | self-layer, system-prompt                        |
| Estate       | Estate          | subjects, worlds                                 |
| Capabilities | Estate (tools)  | tools, commands, mcp, acp, remote-tool instances |

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

**Operation:** Runs continuously without explicit switch commands. Inferred from dialogue, time, frequency, etc. See [`time-perception.md`](time-perception.md).

### Environment + health baseline

**Question: what is my host / runtime quiet state?**

Distinct from scene awareness: banded host and process markers (disk, RSS, deps, MCP/ACP) live as a **session-static** system-prompt copy, with **event-level** Inbox notifications on change. See [`environment-awareness.md`](environment-awareness.md).

### Capability Mask

**Question: what tools and data can I use right now?**

The capability mask is **hard** — it binds tool sets, data scope, and credential permissions. The same digital life may wear different masks per conversation or task to prevent permission leaks and tool pollution.

**Example masks:**

- Developer: terminal, code read/write, ACP Cursor
- Maintainer: FreeAnima config, deployment, database
- Creator: files, notes, media generation
- Research: web search, paper retrieval
- Role-play: dialogue context only, no external tools
- Default: basic chat + limited lookup

**Operation:** Switches at conversation boundaries, explicit commands, or scene-awareness triggers. Each mask is a declared tool/data scope, not a separate identity.

### How They Interact

```text
Scene awareness (soft tuning)
     │  tone, distance, recall bias
     │
     ▼
Capability mask (hard constraints)
     │  tools, permissions, data scope
     │
     ▼
Agent behavior
```

- Scene awareness infers "what we are doing" → may suggest mask switches and presence adjustments
- Capability mask constrains "what I can do" → prevents cross-scene tool misuse
- Both converge in final behavior but evolve independently

For design drafts, open a GitHub Issue (no design-doc directory in docs).

## Memory Storage (Summary)

| Cognitive type   | Description                                                                                 |
| ---------------- | ------------------------------------------------------------------------------------------- |
| Episodic         | Conversation archive; full history retained                                                 |
| Semantic         | Cross-session facts, preferences, experiences; **`procedural` type** for "how-to" knowledge |
| Limbic           | Emotional anchors and imprints — "what was felt"                                            |
| Autobiographical | Meaning of important experiences; recalled on demand                                        |

Pipeline: nightly **sleep-cycle** pipeline (`builtin-sleep-cycle` cron) extracts and maintains memory; `memory_recall` retrieves on demand during chat. Details: [`memory.md`](memory.md), [`sleep.md`](sleep.md).

## Vault & Secrets (Summary)

- **Vault** (ECS `vault_item` in User + Agent libraries) is the authoritative secret store; legacy `~/.password-store` (pass) is **not deleted** on disk but is no longer read at runtime
- The LLM **never sees secret values** — only vault item metadata and config references
- Runtime resolution: `vault("item_id", "field")` and `env("KEY")` in config; Shell `/vault` for management
- Secret values are not written to conversation archives or logs
- CLI: `anima vault list|get`

See [`guide/security.md`](../guide/security.md).

## Runtime Modes

Production (standalone install CLI): `anima service` (systemd --user). Auto-restarts after crashes; only `systemctl stop` stops the service. Source-tree `anima` does **not** register `service` — use `bun run dev:habitat` for local Habitat.

- **Habitat / service**: long-running — Habitat HTTP (`/rpc/v1`), Discord / WeChat Gateway, cron
- **UI**: `src/app/shell/tauri` + `web/dist-*` bundled SPA (Chat + Habitat); Habitat does not host `/habitat`

```bash
# standalone install
anima service start              # default: systemd --user (does not auto-build Web)
anima service start --foreground # foreground (logs to stdout; systemd unit uses this)
anima service status

# monorepo / worktree
just dev                         # Habitat (≥10000) + Vite Web (≥5000)
bun run dev:habitat                  # Habitat foreground (default random ≥10000; not 2658)
bun run dev:web                  # browser shell Vite HMR from :5000 (set FREEANIMA_URL)
bun run build:web                # source deploy / Habitat /web: build dist before start
```

## Tool Architecture (Three Layers)

Tools are registered in three layers but exposed to the LLM as one **flat tool list**. The LLM cares about names and parameters, not origin.

```text
LLM view — flat tool list:
  file_read_file(path)           ← local
  file_write_file(path, content) ← local
  code_execute(code)             ← local
  query_database(sql)            ← MCP server
  send_email(to, subject)        ← MCP server
  acp_cursor(goal, context)      ← ACP agent
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
    env:
      PGOPTIONS: "-c statement_timeout=5s"
  remote_habitat:
    transport: http # Streamable HTTP — use for FreeAnima Habitat /mcp
    url: http://127.0.0.1:2658/mcp
    headers:
      Authorization: "Bearer fa_at_…"
```

### Layer 3: ACP Tools (Agent Client Protocol)

- Each external agent instance registers as **one** task-level tool: `acp_{name}(goal, context)`
- For full task delegation (coding, analysis, booking, etc.); seconds to minutes latency
- Configure in `config.yaml` under `acp_agents`

```yaml
acp_agents:
  cursor:
    command: ~/.local/bin/agent
    args: ["--force", "acp"]
    name: cursor
    description: "Delegate coding, refactoring, and code review"
```

### Comparison

| Dimension   | Local        | MCP              | ACP            |
| ----------- | ------------ | ---------------- | -------------- |
| Runs in     | Process      | External server  | External agent |
| Granularity | Function     | Function         | Full task      |
| Latency     | Milliseconds | Milliseconds–sec | Sec–minutes    |
| Config      | Built-in     | `mcp_servers`    | `acp_agents`   |

Layers can be mixed; the LLM chooses order; FreeAnima registers and routes.

## Conversation vs AutoLlmRun vs Delegation

**Axis:** whether the execution has a **user turn** during the run (not who triggered it).

| Kind                 | User turn     | PG persistence                                      | Process trace   | Sleep pipeline                          |
| -------------------- | ------------- | --------------------------------------------------- | --------------- | --------------------------------------- |
| **Conversation**     | yes           | `sessions` + `messages` (code still says `session`) | message archive | participates (light sleep, dream input) |
| **AutoLlmRun**       | no            | `auto_llm_runs` via `runAutoLlm()`                  | audit row, TTL  | excluded                                |
| **Delegation (ACP)** | no (external) | parent conversation + `acp_tasks`                   | optional        | result via parent conversation          |
| **Script cron**      | no            | `cron_log` only                                     | stdout file     | excluded                                |

AutoLlmRun covers: cron agent branch, sleep LLM stages, future internal subagents. Tool context uses `contextKind: auto_llm` so `memory_remember` does not attach `source_conversations`. Cron `no_agent` shell scripts are **not** AutoLlmRun.

## Session Goal

**Question: should this conversation keep working toward a stated outcome?**

Session Goal is an **in-process autonomous loop** at the Estate / orchestration layer — distinct from ACP async delegation:

| Dimension    | Session Goal                    | ACP                                   |
| ------------ | ------------------------------- | ------------------------------------- |
| Scope        | Single conversation             | External agent task                   |
| Trigger      | `/goal` slash + post-turn judge | Tool call + callback turn             |
| Persistence  | `conversations.goal` JSONB      | `conversations.acp_tasks`             |
| Continuation | Same SSE stream, turn budget    | Independent message after task update |

Judge uses optional `llm.profiles.goal_judge`; on judge call/parse failure the goal is **paused** (warn logged + status line in chat). User messages preempt the loop; `/goal pause` / `/goal resume` control auto-continue without clearing state. See [`goal.md`](../features/goal.md).

## Client UI（web/dist SSOT + 原生壳打包）

**Portal Shell 运行时**：**Tauri**（Rust 主进程 + 系统 WebView；桌面与 Android 统一壳层）。壳规则：[`.agent/rules/tauri-shell.md`](../../.agent/rules/tauri-shell.md)。**禁止**为 companion 再打 Node sidecar；`remote_tools.attach` 在第一方 overlay WebView（见 Desktop companion）。

**UI 源码产物**：`src/app/shell/web/dist`（`base: /web/`）。

| 客户端       | UI 加载                                                                    | 更新方式                                                                                                                                                                              |
| ------------ | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 浏览器 / PWA | Habitat 托管 `/web/*`（`config.yaml` `web.enabled`，或 `anima web start`） | Service Worker 提示新版本后**手动重载**（不自动刷新）；**不**跟 GitHub 包通道                                                                                                         |
| Desktop      | **安装包内** `ui/web`（`prepare-tauri-ui`）；调试可用 Tauri dev            | 按 bake `channel` 查 GitHub（`release`=stable latest + semver；`canary`=tag `canary` + commit）；用户确认后 NSIS 覆盖；可切换 `release`⇄`canary`；About 可选公共 gh-proxy（默认直连） |
| Mobile APK   | **安装包内** `ui/web`（本地同源）；Habitat 仅 API                          | 同上轨语义；有 APK asset 才提示；确认后系统安装器覆盖；可切换轨；同上代理选择                                                                                                         |
| Standalone   | 嵌入 Web UI 的单文件 `anima`                                               | `anima upgrade` / `--channel release\|canary` / `--proxy …`；`dev` / 源码安装不可换轨；curl 安装脚本可用 `PROXY=…`                                                                    |

壳层保留原生能力（Tauri commands / prefs / 通知等）。**无壳内 UI OTA**：原生端不从 Habitat 热替换 SPA。允许**用户确认后**的安装包级覆盖（Desktop 安装包 / Mobile APK / Standalone `anima upgrade` → 独立前缀如 `~/.anima/standalone`）。分发轨 SSOT 为安装包 bake 的 `build-meta.channel`（`release` / `canary` / `dev`）。Habitat 配置统一走 settings「连接」（`/settings`）；无独立 bootstrap Habitat 页。

### 两层模型

| 层                   | 驱动                                | 职责                                                                                         |
| -------------------- | ----------------------------------- | -------------------------------------------------------------------------------------------- |
| **交互与原生能力层** | 壳运行时（Tauri / Web）             | 存储、IPC、Habitat 连接后端、settings registry **内容**、hash 路由、长按 vs 右键、滑动手势等 |
| **布局层**           | **仅视口断点**（壳不锁定底栏/顶栏） | 窄/中/宽三档；列表 drawer / 并列 / 三栏；settings **chrome**（tabs vs 侧栏）                 |

手机端通常只有窄档，但 **手机端 ≠ 窄布局**；Portal / 浏览器窗口可以是窄、中、宽任意档。

### 布局层断点

| 档位 | 视口        | 布局粗档            | Nav IA      | 页内     |
| ---- | ----------- | ------------------- | ----------- | -------- |
| 窄   | ≤1023px     | `compact` 移动布局  | 底栏 + More | drawer   |
| 中   | 1024–1279px | `expanded` 桌面布局 | 顶栏全模块  | 两栏并列 |
| 宽   | ≥1280px     | `expanded` 桌面布局 | 顶栏全模块  | 三栏并列 |

`resolveLayoutMode()`：窄 → `compact`，中宽 → `expanded`（URL / `config.json` 可覆盖）。`detectSettingsChromePlatform()` 跟布局粗档（设置页 chrome）；settings 字段差异由壳子维 `resolveShellBindings()` / `getShellKind()` 决定。

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

- **EventBus**: async notification transport (Redis queue); production code currently emits topics such as `session:updated` with **no registered handlers** — ACP callbacks use direct `onSessionUpdated` instead. **Not** used for sleep orchestration.
- **Pipeline Runner**: explicit DAG for background cycles (sleep-cycle: light → deep → cross-domain maintenance steps). State in `~/.anima/runtime/pipeline_*_run.json`; Habitat API for diagnostics.
- **Hooks**: sync interceptors — validation or clarification at message ingress, turn end, tool return, etc.

Complementary: Pipeline Runner handles scheduled multi-step background work; Hooks handle "may this proceed before/during"; EventBus remains available for future cross-process fan-out but is not on the sleep path.

## Desktop companion (Habitat SSOT)

The desktop companion is an **unreachable local app** that **actively connects** to Habitat and registers remote tools in the **first-party overlay WebView** (shell provides window/IPC/FS only — **not** a Node sidecar), with a split boundary:

| Concern                             | Habitat (`src/features/companion/`)              | Local install                             |
| ----------------------------------- | ------------------------------------------------ | ----------------------------------------- |
| Behavior, slots, active model       | `companion_profile` entity + Habitat RPC         | Cache in `~/.anima/companion/config.json` |
| VRM / VRMA library                  | Files on Habitat host + content-hash metadata    | Lazy download to desktop cache            |
| FBX → VRMA                          | Habitat service only                             | Not bundled in desktop installer          |
| Settings UI                         | Habitat RPC + `/rpc/v1/companion/*` upload       | Desktop Settings section (not Habitat)    |
| VRM render, float window, patrol    | —                                                | Tauri Portal shell + overlay SPA          |
| Agent tools (`bubble`, `play_slot`) | Habitat RPC `tool.*` after `remote_tools.attach` | Overlay WebView-host 执行（本地 runtime） |

**Remote tools ≠ Portal / MCP**: Portal shells and Chat/Settings use Habitat RPC for UI only. Dialable peers expose tools via **MCP**. Remote-tool attach exists solely when Habitat cannot dial the app (companion overlay today; future independent local apps). Routing uses `instance_id` (same machine may have multiple instances). See [`companion.md`](../features/companion.md)、[`habitat-rpc.md`](../guide/habitat-rpc.md).

## Direction

Capability vision and discussions: [GitHub Issues](https://github.com/freeanima-org/freeanima/issues) (labels `enhancement`, `discussion`, `security`). This file does not track todos.

## Constraints

- Principles and structure live here; no concrete task lists
- Fast-changing behavior follows the running service, not stale prose
- Actionable work goes in GitHub Issues; close when done
