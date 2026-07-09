---
title: Notifications
---

# Notifications

代码里 **`notification*`** 指 **Inbox（收件箱）**；瞬时提醒使用 **`alert*`** 命名空间（`shell-sdk/alert`），二者概念分离。

## Inbox（收件箱）

PG-backed in-app inbox for **user** and **agent** subjects (entity model). Cron results, task due reminders, and LLM tools write here; Shell UI lists and marks read via SAP.

## Alert（瞬时提醒，本机-only）

**不走 Hub RPC、不写 PG、不跨设备同步。** 各 shell 端在启动时注册 `AlertBackend`（web / desktop / mobile），Feature 调用 `deliverAlert()` 使用**当前设备**系统通知通道。

| 事件                      | Inbox |               Alert               | SSOT                |
| ------------------------- | :---: | :-------------------------------: | ------------------- |
| 任务到期/提醒             |   ✓   | 可选（后续：本机读 inbox 后弹窗） | `task_item` + inbox |
| Agent `notification_send` |   ✓   |               可选                | inbox               |
| Chat 新消息               |   ✗   |             ✓（后续）             | `conversation`      |
| 番茄钟阶段结束            |   ✗   |                 ✓                 | `pomodoro_session`  |

番茄钟阶段结束**不写 inbox**；会话历史由 `pomodoro_session` entity 承担。

实现：`src/frontend/shell-sdk/alert/` + 各端 backend。

| 端          | 通道                                                                                                                                     |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| **desktop** | Electron 主进程 `Notification`（IPC `shell:alert:show`）→ OS 原生通知                                                                    |
| **web**     | Web Notification API                                                                                                                     |
| **mobile**  | Capacitor **Local Notifications**；`bootstrap-capacitor` 注入 `satelliteShell.showNativeAlert`（远程 Hub 页不依赖 Web Notification API） |

---

（以下为 Inbox 专章，保留原行为说明。）

PG-backed in-app inbox for **user** and **agent** subjects (entity model). Cron results, task due reminders, and LLM tools write here; Shell UI lists and marks read via SAP.

## Recipients

Configure subject entity ids in `config.yaml` **`worlds`** section (SSOT; legacy `notifications` still read as fallback):

```yaml
worlds:
  user_subject_id: 1 # type=user entity; default 1
  agent_subject_id: 2 # type=agent entity; default 2
```

`user_world_id` / `agent_world_id` are derived at Hub boot from each subject's `default_private_world_id` (see [`entity-model.md`](entity-model.md)).

Each row stores `recipient_kind` (`user` | `agent`) and `recipient_id` (entity id string). Unconfigured installs default to subject ids `1` / `2`.

| Writer                                  | Typical recipient                          |
| --------------------------------------- | ------------------------------------------ |
| Cron success (when `notify_on_success`) | **both** user + agent                      |
| Cron failure                            | **both** user + agent                      |
| Task due reminder                       | user                                       |
| `notification_send` tool                | user / agent / both; optional `subject_id` |

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
