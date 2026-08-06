---
title: Coding Workbench
---

# Coding Workbench

> **Coding** / **编码工作台**：Portal 内独立前哨窗（UI + `remote_tools.attach`），在开发机执行 FS / 终端 / patch；Habitat 做脑与项目 World。与 [Desktop Companion](./companion.md) 同类 Outpost，**不是**第二个 App，也**不是** [Project Management](./project.md)（任务/文件夹 PM）。

## Goals

- Personal toy → gradual daily driver for **Agent coding** (not Tab completion first).
- Chat can already vibe; the bottleneck is **workbench UX** (explore / patch / multi-repo sessions).
- Phase 1 focus: **read the repo (explore)**; write + diff next. LSP / Debugger / SSH Remote are **later**.

## Runtime topology

- Habitat on a **stable weak machine** (brain + memory + orchestration).
- Hands on a **dev-machine Outpost**: FS / search / terminal / (later) patch.
- **Cross-machine Outpost is required**, not optional.

```text
Coding outpost window ── RPC + attach ──► weak-machine Habitat
Main Chat / tasks      ── RPC only ─────► same Habitat
```

## Product shape

- **Coding = independent outpost window** (UI + `remote_tools.attach`), same class as Companion; same **Tauri Portal**, not a second app.
- Feature code: `src/features/coding/` — **do not** add Coding into `features/companion/`.
- 「产品 UI 不 attach」applies to **main-shell product modules** (Chat, Task, …). An **outpost window may be both UI and hands**.
- Keep-alive aligns with **Companion process/shell survival**, but **attach lifetime differs**:
  - Companion: hide display **closes** the WebView → attach tears down (offline).
  - Coding: prefer **hide without close** so the Outpost stay attached for Agent tool calls. Do **not** tie attach to the main window lifecycle.

## Connection and multi-repo sessions

- Default: **one attach, one `instance_id`** (one Coding window = one local hand).
- **Multi-repo ≠ multi instance**. Cursor-style “one UI, many repos” = **many Agent sessions**, each with its own locked `workspaceRoot`（一会话一根；创建后不可变）.
- Multiple attaches only for: multi-machine outposts, Companion+Coding, or rare dual Coding windows.
- `instance_id` = which local connection; **not** which repository.

## Three identity layers

| Layer                | Meaning                                                                             | Example                                                      |
| -------------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| **`stable_key`**     | Cross-machine logical project id (on **World**)                                     | `git:github.com/org/foo`, `novel:crane-summer`               |
| **Project World**    | Knowledge/task boundary for that project (prefer **public**, one World per project) | entity + `world_config`                                      |
| **`workspace_root`** | Checkout path on a machine                                                          | conversation `platform_info`; all FS/terminal relative to it |

- Grouping / memory / tasks → World / `stable_key`
- Read files / run commands → current session `workspace_root`
- Keep them separate to avoid “same origin, wrong directory” bugs.

Conversation meta also stores `project_world_id`. Coding sessions should use platform string `remote:coding:{instanceId}` (not plain `chat`).

## World strategy

- Do **not** dump multi-repo knowledge into Agent private (mud ball), and do **not** put it all in Commons.
- **Private World**: subject personalization (style, prefs, weakly project-related).
- **Project Public World**: project-bound data (explore notes, that project’s tasks, …); later multi-agent via **grants**.
- **Commons**: Habitat-wide shared assets (builtin Skills, companion resources), not tied to one project.
- Shell User/Agent toggle still scopes daily life; coding sessions carry **`project_world_id`** context.

## `stable_key` on World

- Generic field on `world_config` body: **`stable_key`** (never `repo_key`).
- Coding may **derive** from normalized git origin; other domains reuse prefixes: `git:` / `novel:` / `manual:`.
- `title` = editable display name; `stable_key` = machine identity, **unique** when set (PG partial unique index + app check).

## `.anima/project.json` (committable)

Minimal team-committable set:

```json
{
  "version": 1,
  "stable_key": "git:github.com/org/freeanima"
}
```

Optional: `display_name` (team canonical name).

**Do not commit:** `world_id` (Habitat-local). Cache locally (`project.local.json` or Outpost prefs).

With a git remote, the file may be omitted and the key computed; the file pins the key for no-remote / non-git projects.

## Workbench UI (P0)

交互对标 **Cursor Agents Window**：三栏 **Agents | 对话 | Context**，深色 Agent 优先。

### 会话 × 工作区（硬约束，对接未来 worktree）

- **一对话一根工作区**：本地 `CodingAgentSession.workspaceRoot: string | null`（创建时可明确选「无工作区」）。
- **创建后不可变**：New Agent 选定路径（或无）即锁定；UI **无**添加/移除/更换文件夹。换目录 = **新建** Agent。
- Habitat `conversation.create` 的 `workspace_root` 与本地字段一致且同样视为不可变；本地 `conversationId` 持久化后复用。
- 左栏按 `workspaceRoot` 的 basename 分组（`null` →「无工作区」）；同仓多会话 = 同组多条（为后续同仓不同 worktree 路径留口：每条仍是独立 `workspaceRoot` 字符串）。
- 本地存储 key `freeanima:coding:agent-sessions:v2`；从 v1 多根迁移时只保留 `activeRoot ?? workspaceRoots[0] ?? null`。

### 栏位

- **左栏 Agents**：Repositories 分组 + 会话列表；Search（Ctrl/Cmd+K）；New Agent。
- **中栏对话**：空态居中输入；有消息后线程 + 底部 follow-up；流式走 `getBundledRpcStreamClient`（**不**整包 import Chat SPA）；platform = `remote:coding:{instanceId}`。
  - **复用 Chat 原子（禁止挂载 ChatApp）**：`ConversationTranscript`（**消息列表 + stick-to-bottom + 向上懒加载 SSOT**；新增气泡样式 / display 分支只改该组件，禁止 Coding 平行 `display.map`）、`slash-command-menu` / `conversation-command-api`（slash）、`stream-events` + Markdown（流式 token）、`upsert-tool-block` + `ToolBlockBubble`（经 Transcript）、`LlmDebugPanel` + `useChatLlmDebugEnabled`（LLM 调试；设置页开关与 Chat 共用）。compose / 空态 hero / 三栏布局皮肤留在 Coding SPA。
  - 历史分页与 Chat 同契约：`conversation.messages` 的 `before_pos` / `has_more_before` / `from_pos`。
- **右栏 Context**（默认展开）：Files（可展开树）/ Preview（Shiki）/ Changes（按 path 聚合 + unified diff + Apply Changes）/ Terminals（`terminal_run` 输出日志；**非**交互 PTY）。
- Search Actions：**无**「更换工作区」，有「新建 Agent」。
- 理解笔记：挂在 Files 区（需 `project_world_id`）。

## Tools (P0)

Outpost `local_name`s (executed on the **dev machine** inside the Coding WebView / thin Rust IPC):

| Tool           | Role                                                                    |
| -------------- | ----------------------------------------------------------------------- |
| `file_list`    | Read-only tree                                                          |
| `file_read`    | Read file                                                               |
| `file_search`  | Search files/content                                                    |
| `file_patch`   | Minimal edit (`old_string` / `new_string`); UI diff review before apply |
| `terminal_run` | One-shot command (optional `terminal_process`)                          |

Paths are sandboxed under the session `workspace_root`. Coding sessions must **default to these Outpost tools** — do **not** silently fall back to Habitat-local `file_*` (the server does not have your repo).

Builtin subagent `explorer` uses Habitat `file_*` and is **not** a workspace explorer. Prefer `coding-explorer` for Outpost read-only tools.

## Phasing

**P0 (this module)**

- Coding outpost window + attach
- `workspace_root` + `project_world_id` / `stable_key`
- Read-only explore + terminal; coding-explorer subagent
- Minimal patch + diff review
- Understanding notes into **project World** (`coding_note`) via Habitat RPC `coding.noteCreate` / `coding.noteList`（Coding 窗「理解笔记」）

**Later**

- LSP / refactor / Debugger
- SSH Remote (same tool contract, different backend)
- Heavier indexing / symbols
- Interactive PTY
- Cloud / Worktree 检出与真 Git Commit&Push（今日 Changes 用 Accept/Reject 聚合代替）

## One-line summary

> Weak-machine Habitat = brain + project World; one local Coding outpost window = hands; multi-repo via session paths + World `stable_key`; teams pin only `stable_key` in-repo; win explore + workbench first, then IDE depth.

See also: [Habitat RPC](../ops/habitat-rpc.md), [architecture](../product/architecture.md), [companion](./companion.md), [entity model](../product/entity-model.md).
