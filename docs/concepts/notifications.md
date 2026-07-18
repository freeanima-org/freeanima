---
title: Notifications
---

# Notifications

代码里 **`notification*`** 指 **Inbox（收件箱）**；瞬时提醒使用 **`alert*`** 命名空间（`shell-sdk/alert`），二者概念分离。

## Inbox（收件箱）

PG-backed in-app inbox for **user** and **agent** subjects (entity model). Cron results, task due reminders, and LLM tools write here; Shell UI lists and marks read via SAP.

## Alert（本机提醒，本机-only）

**不走 Hub RPC、不写 PG、不跨设备同步。** 各 shell 端在启动时注册 `AlertBackend`（web / desktop / mobile）。Feature 通过 `shell-sdk/alert` 使用**当前设备**系统通知通道。

Alert 分两档（同一契约，成对）：

| 档         | API                                           | 含义                             |
| ---------- | --------------------------------------------- | -------------------------------- |
| **即时**   | `deliverAlert` / `AlertBackend.show`          | 现在立刻弹                       |
| **预登记** | `scheduleLocalAlert` / `cancelScheduledAlert` | 在未来时刻本机弹；**必须可取消** |

硬约束：**schedule ⊕ cancel 成对**。只登记不能取消 = 不可用（暂停/手动中止后仍会到点骚扰）。同 `tag` 再 `schedule` = replace（先 cancel 再登记）；`cancel` 对不存在的 id/tag **幂等成功**。

**不是** Hub 后台进程 / Inbox。任务到期「inbox→本机弹」可后续复用同一 `schedule` API。

### 三壳 durability

| 壳          | `scheduleDurability` | 预登记存活边界                                            |
| ----------- | -------------------- | --------------------------------------------------------- |
| **mobile**  | `os`                 | 杀进程后 OS 仍可按 `at` 弹出（Local Notifications）       |
| **desktop** | `process`            | 应用未退出（托盘存活）即可；关主窗口仍响；`quit` 后不保证 |
| **web**     | `process`（页进程）  | **best-effort**：标签页存活才准；关标签即丢               |

### 番茄钟

**例外（Hub 同步，非 Alert）**：运行中活跃态（`pomodoro_active` + `pomodoro.active.*`）跨端 **last-write-wins**；**阶段结束系统通知仍仅本机**。多端同步靠 `put` / `clear` 后的 `pomodoro.active.changed`；重连与页面可见时 `active.get` 兜底，**不作周期轮询**。

阶段开始 / 继续时 `scheduleLocalAlert`（`phaseEndsAt`）；暂停、**手动取消进行中会话**（`runPhaseAbort`）、阶段完成等路径 `cancelScheduledAlert`。状态机推进仍由 `PomodoroShellWatcher`（或重开后 catch-up）负责；预登记只保证提醒。

| 事件                      | Inbox |               Alert               | SSOT                |
| ------------------------- | :---: | :-------------------------------: | ------------------- |
| 任务到期/提醒             |   ✓   | 可选（后续：本机读 inbox 后弹窗） | `task_item` + inbox |
| Agent `notification_send` |   ✓   |               可选                | inbox               |
| Chat 新消息               |   ✗   |             ✓（后续）             | `conversation`      |
| 番茄钟阶段结束            |   ✗   |      ✓（预登记 + 即时兜底）       | `pomodoro_session`  |

番茄钟阶段结束**不写 inbox**；会话历史由 `pomodoro_session` entity 承担。

实现：`src/frontend/shell-sdk/alert/` + 各端 backend。

| 端          | 即时通道                                                 | 预登记                                                                |
| ----------- | -------------------------------------------------------- | --------------------------------------------------------------------- |
| **desktop** | Electron 主进程 `Notification`（IPC `shell:alert:show`） | 主进程 timer（`shell:alert:schedule` / `cancel`）；`before-quit` 清表 |
| **web**     | Web Notification API                                     | 页内 `setTimeout`（best-effort）                                      |
| **mobile**  | Capacitor Local Notifications（`showNativeAlert`）       | 同一插件 `schedule({ at })` + `cancel`                                |

---

（以下为 Inbox 专章，保留原行为说明。）

PG-backed in-app inbox for **user** and **agent** subjects (entity model). Cron results, task due reminders, and LLM tools write here; Shell UI lists and marks read via SAP.

## Recipients

Subject entity ids are bound at Hub boot into **`ResolvedWorldContext`** and persisted to `hub_runtime_config.worlds` (see [`entity-model.md`](entity-model.md)). Operators do **not** need to hand-maintain these ids on a new instance.

Optional override (advanced; rarely needed):

```yaml
# hub_runtime_config (Shell → Hub 服务设置 → worlds)，或冷启动后由 boot 自动回写
worlds:
  user_subject_id: 109 # type=user entity
  agent_subject_id: 110 # type=agent entity
```

Legacy `notifications.user_subject_id` / `agent_subject_id` are still read as fallback when `worlds` is unset.

`user_world_id` / `agent_world_id` are derived at Hub boot from each subject's `default_private_world_id`.

Each row stores `recipient_kind` (`user` | `agent`) and `recipient_id` (entity id string from `ResolvedWorldContext`).

| Writer                                  | Typical recipient                            |
| --------------------------------------- | -------------------------------------------- |
| Cron success (when `notify_on_success`) | **both** user + agent                        |
| Cron failure                            | **both** user + agent                        |
| Task due reminder                       | user                                         |
| Env/health baseline change              | **both** user + agent (`builtin-env-health`) |
| `notification_send` tool                | user / agent / both; optional `subject_id`   |

Dream pipeline **does not** create notifications (reminder removed).

## Agent consciousness

Unread agent notifications are injected at inference time via a runtime-only **`assistant(name=notification_context)`** turn immediately before the last `user` message. They are **not** persisted in conversation messages.

The inject block includes a **Handling protocol** (three-way triage by whether action is needed — not by `source_kind`).

### Agent handling protocol

For each injected `[id:…]` line, classify by content (not by writer/source):

| Category                          | Action                          | Mark read                                       |
| --------------------------------- | ------------------------------- | ----------------------------------------------- |
| **Informational only**            | Acknowledge in reply if useful  | Batch `notification_mark_read({ ids: [...] })`  |
| **Action needed, quick**          | Handle within ~3 tool rounds    | `notification_mark_read` that id after done     |
| **Action needed, slow/uncertain** | Ask the user before a long task | Do **not** mark read until approved and handled |

Unmarked unread items are re-injected on the next user turn. Use `notification_list(recipient=agent, read_filter=unread)` if the inject block is truncated.

## LLM tools (ToolSet `notification`)

Load via `toolset_load` with `notification`.

| Tool                     | Scope parameter                                                          |
| ------------------------ | ------------------------------------------------------------------------ |
| `notification_send`      | Optional `subject_id` (overrides `target`); default `target=both`        |
| `notification_list`      | Optional `subject_id` (overrides `recipient`); default `recipient=agent` |
| `notification_mark_read` | Notification id only (global)                                            |

`subject_id` must be the configured `user_subject_id` or `agent_subject_id` from system prompt / `ResolvedWorldContext`.

## Task reminder scan

Builtin cron `builtin-task-reminders` runs **every minute** (`* * * * *`).

For each pending `task_item`:

1. **Trigger time**: `remind_at` if set, else `due_at`; if neither, skip.
2. **Send** when `trigger <= now` and `last_notified_at` is absent or `last_notified_at < trigger` (entity JSONB field on schedulable body).
3. **After send**: patch `last_notified_at` on the task entity; do not rely on day-based `source_ref` dedup alone.

**Product rule (confirmed)**: one trigger per task per scan — **remind first, else due**; not separate notifications for both when both are set.

Task reminders are delivered to the **user** inbox via cron (Shell UI / SAP), not injected into agent context and not duplicated by `notification_send`.

## Tools

ToolSet `notification`:

- `notification_send`
- `notification_list`
- `notification_mark_read` — `id` or `ids` (batch, max 20)

Included in default conversation toolsets when registered.

## SAP (read)

- `notification.list` — requires `recipient_kind` + optional `recipient_id`
- `notification.markRead`
- `notification.recipients` — configured subject ids for UI tabs

No SAP create RPC in v1; writes are Hub-internal + tools.

## Related

- Entity subjects: [`entity-model.md`](entity-model.md)
