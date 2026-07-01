---
title: Architecture
---

# FreeAnima Architecture

System-level constraints and long-lived design principles.

## Core Principles

- The memory system may be layered internally, but the LLM sees a single entry point
- Memory orchestration is built into the runtime; the LLM does not control memory pipelines
- Credential management is a first-class system concern
- Asset management is a first-class system concern
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
│    └── Semantic                                │
│    └── Episodic                                │
│    └── Procedural                              │
│    └── Limbic / Imprint                        │
│    See [`memory.md`](memory.md)                │
├───────────────────────────────────────────────┤
│ ④ Estate                                       │
│    "What do I have / rely on?"                  │
│    ├── Body: VM / OS / network / toolchains    │
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

Shell UI **`/tasks`** and **`/email`** are primary module entries (entity-backed); legacy Admin email route removed.

### Platform UI layering

| Layer              | Platform-native?             | Location                                                 | 数据通道      |
| ------------------ | ---------------------------- | -------------------------------------------------------- | ------------- |
| Shell / capability | Yes                          | `app/desktop`, `app/mobile`, companion, Hub wiring       | preload/IPC   |
| Shared SPA shell   | Branch on `detectPlatform()` | `packages/shell-ui`                                      | 无 SAP wire   |
| hub-rest 前端      | Admin embed                  | `platform/admin-frontend` + `ui-kit` + `shell-sdk`       | Eden `/api`   |
| SAP 产品面         | Satellite apps               | `satellites/*` + `sap-contract` + `ui-kit` + `shell-sdk` | SAP `/sap/v1` |

Nav and primary layouts **must use `detectPlatform()`** (Electron / native shell), not viewport breakpoints alone. Responsive CSS is for desktop window resize only.

**边界**：`shell-ui` 与 `admin-frontend` 禁止 import `sap-contract`；SAP wire 仅在 `satellites/*/app` 内。详见 [`.agent/rules/frontend-features.md`](../../.agent/rules/frontend-features.md)。

### Admin navigation ↔ cognitive layers

Admin sidebar is grouped (not flat storage tables). Map new features onto these user-visible concepts:

| Group        | Cognitive layer | Routes (representative)                             |
| ------------ | --------------- | --------------------------------------------------- |
| Runtime      | Estate + ops    | dashboard, config, credentials, cron                |
| Memory       | Memory          | memory hub, browse sub-routes, sleep, auto-llm-runs |
| Self         | Self            | self-layer, system-prompt                           |
| Estate       | Estate          | subjects, worlds, fridge-magnet                     |
| Capabilities | Estate (tools)  | tools, commands, mcp, acp, satellites               |

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

| Cognitive type   | Description                                               |
| ---------------- | --------------------------------------------------------- |
| Episodic         | Conversation archive; full history retained               |
| Semantic         | Cross-session facts, preferences, experiences, procedures |
| Limbic           | Emotional anchors and imprints — "what was felt"          |
| Autobiographical | Meaning of important experiences; recalled on demand      |

Pipeline: nightly **sleep-cycle** pipeline (`builtin-sleep-cycle` cron) extracts and maintains memory; `memory_recall` retrieves on demand during chat. Details: [`memory.md`](memory.md), [`sleep.md`](sleep.md).

## Credential System (Summary)

- [pass](https://www.passwordstore.org/) (GPG) is the sole credential store; the deployer's pass repo is a first-class runtime asset
- The LLM **never sees credential values** — only paths and metadata
- Runtime injection: credentials available only in code execution / terminal environments
- Credential values are not written to conversation archives or logs
- Platform adapters (Discord, etc.) read tokens from pass at startup
- CLI: `anima credential {list,get,add}`

See [`guide/security.md`](../guide/security.md).

## Runtime Modes

Production: `anima service` (systemd --user). Auto-restarts after crashes; only `systemctl stop` stops the service.

- **service**: long-running — Hub HTTP (`/api`, `/sap/v1`), Discord / WeChat Gateway, cron
- **chat**: single non-interactive turn (CLI or piped stdin)
- **UI**: app/desktop / app/mobile bundled SPA (Chat + Admin); Hub does not host `/admin`

```bash
anima service start              # default: systemd --user
anima service start --foreground # foreground (logs to stdout)
bun run dev:web                  # browser shell (Chat + Admin + settings, Vite HMR; Hub must be running)
anima service status
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
- Configure in `config.yaml` under `mcp_servers`

```yaml
mcp_servers:
  database:
    command: npx @modelcontextprotocol/server-postgres
    args: ["--connection", "postgresql://..."]
    transport: stdio
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

Judge uses optional `llm.profiles.goal_judge`; fail-open on errors. User messages preempt the loop; `/goal pause` stops auto-continue without clearing state. See [`goal.md`](../features/goal.md).

## Client UI（Hub Web SSOT + 薄壳）

**UI 唯一发布产物**：`app/web/dist`，Hub 托管于 `/web/*`（`web.enabled` 或 `anima web start`）。Desktop / Mobile / 浏览器 / PWA 共用同一 SPA；壳层只保留原生能力（Electron preload、Capacitor Preferences/Keyboard、伴侣 sidecar 等）。

| 呈现       | 触发                                              | Nav IA      |
| ---------- | ------------------------------------------------- | ----------- |
| `compact`  | 手机浏览器（触屏窄屏）、PWA standalone、Capacitor | 底栏 + More |
| `expanded` | Electron、桌面浏览器                              | 顶栏全模块  |

| 客户端       | UI 加载                                                               | 壳发版                   |
| ------------ | --------------------------------------------------------------------- | ------------------------ |
| 浏览器 / PWA | Hub `/web/*`                                                          | 随 Hub / `anima upgrade` |
| Desktop      | 默认 Hub `/web/*`（`DESKTOP_UI_MODE=bundled` 回退本地 static）        | 仅 Electron / 伴侣变更   |
| Mobile APK   | bootstrap → Hub `/web/*`（`MOBILE_UI_MODE=bundled` 回退 bundled SPA） | 仅 Capacitor 插件变更    |

| Module | Connection                       | Notes                  |
| ------ | -------------------------------- | ---------------------- |
| Chat   | SAP WebSocket `/sap/v1`          | `/web/chat`            |
| Admin  | Hub REST `/api/*` (CORS + shell) | `/web/admin/dashboard` |

`/web/config.json` 提供 `hub_url`、`ui_version`、`min_shell_version`（壳↔UI 版本协商）。

## Events and Hooks (Summary)

- **EventBus**: async notification transport (Redis queue); production code currently emits topics such as `session:updated` with **no registered handlers** — ACP callbacks use direct `onSessionUpdated` instead. **Not** used for sleep orchestration.
- **Pipeline Runner**: explicit DAG for background cycles (sleep-cycle: light → deep → cross-domain maintenance steps). State in `~/.anima/runtime/pipeline_*_run.json`; Admin API for diagnostics.
- **Hooks**: sync interceptors — validation or clarification at message ingress, turn end, tool return, etc.

Complementary: Pipeline Runner handles scheduled multi-step background work; Hooks handle "may this proceed before/during"; EventBus remains available for future cross-process fan-out but is not on the sleep path.

## Direction

Capability vision and discussions: [GitHub Issues](https://github.com/freeanima-org/freeanima/issues) (labels `enhancement`, `discussion`, `security`). This file does not track todos.

## Constraints

- Principles and structure live here; no concrete task lists
- Fast-changing behavior follows the running service, not stale prose
- Actionable work goes in GitHub Issues; close when done
