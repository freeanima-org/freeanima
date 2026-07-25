---
title: Notifications
---

# Notifications

代码里 **`notification*`** 指 **Inbox（收件箱）**；瞬时打断使用 **`alert*`** / `deliverLocalReminder`。产品上的 **通知 / 提醒 / 本机打断** 三分法、任务 due vs 多提醒、Habitat **睡到下次** 时间发现、壳层 Attention 集中订阅 → 切面 [`notification-and-reminder.md`](../aspects/notification-and-reminder.md)。

## Inbox（收件箱）

PG-backed in-app inbox for **user** and **agent** subjects (entity model). Cron job results, **task due** (target), env/health changes, and LLM tools write here; Shell UI lists and marks read via SAP. Advance task reminders are **not** Inbox rows — see the aspect.

## Alert（本机提醒，本机-only）

**不写 PG、不做跨设备认领。** 各 shell 端在启动时注册 `AlertBackend`（web / desktop / mobile）。产品提醒统一经 `portal-sdk/local-reminder` 的 **`deliverLocalReminder`**：

| 本机条件                                        | 通道                                    |
| ----------------------------------------------- | --------------------------------------- |
| desktop 且伴侣窗口显示（`getCompanionVisible`） | `enqueueCompanionBubble`（不弹本机 OS） |
| 否则（含 web / mobile）                         | `deliverAlert`（系统通知）              |

多端策略为**宽松**：各 Portal 独立提醒；伴侣打开 ≠ 人在旁，**不**因此压制手机/Web。同端在源路由 focused 时可用 `suppressOsWhenFocused` 压制 OS。伴侣气泡**不**视为已读/ack。

Alert 分两档（同一契约，成对）：

| 档         | API                                              | 含义                             |
| ---------- | ------------------------------------------------ | -------------------------------- |
| **即时**   | `deliverLocalReminder` → `deliverAlert` / bubble | 现在立刻提示                     |
| **预登记** | `scheduleLocalAlert` / `cancelScheduledAlert`    | 在未来时刻本机弹；**必须可取消** |

硬约束：**schedule ⊕ cancel 成对**。只登记不能取消 = 不可用（暂停/手动中止后仍会到点骚扰）。同 `tag` 再 `schedule` = replace（先 cancel 再登记）；`cancel` 对不存在的 id/tag **幂等成功**。

用户 Inbox 新建经 `notification.subscribeInbox` → `notification.created` 推到各端，再走 `deliverLocalReminder`。Chat 未读会话数上升同理（`ChatUnreadShellWatcher`）。`subscribeInbox` 的 pump 与 chat 一样绑定 Habitat RPC **WS 会话**（断线 abort，重连后可重建）；勿用进程级单例 Map，否则重连后推送会静默丢失而 `notification.list` 仍正常。

### 三壳 durability

| 壳          | `scheduleDurability` | 预登记存活边界                                            |
| ----------- | -------------------- | --------------------------------------------------------- |
| **mobile**  | `os`                 | 杀进程后 OS 仍可按 `at` 弹出（Local Notifications）       |
| **desktop** | `process`            | 应用未退出（托盘存活）即可；关主窗口仍响；`quit` 后不保证 |
| **web**     | `process`（页进程）  | **best-effort**：标签页存活才准；关标签即丢               |

### 番茄钟

**例外（Habitat 同步，非 Alert）**：运行中活跃态（`pomodoro_active` + `pomodoro.active.*`）跨端 **last-write-wins**；**阶段结束本机提醒仍仅本机**（`deliverLocalReminder`）。多端同步靠 `put` / `clear` 后的 `pomodoro.active.changed`；重连与页面可见时 `active.get` 兜底，**不作周期轮询**。

阶段开始 / 继续时：伴侣**未**显示则 `scheduleLocalAlert`（`phaseEndsAt`）；伴侣显示时**不**预登记（OS 定时器无法走气泡），靠 `PomodoroShellWatcher` 即时路径气泡。暂停、**手动取消进行中会话**（`runPhaseAbort`）、阶段完成等路径 `cancelScheduledAlert`。伴侣显隐切换时重新 sync 预登记。

| 事件                       |      Inbox（目标）       |          本机打断           | SSOT                  |
| -------------------------- | :----------------------: | :-------------------------: | --------------------- |
| 任务**到期** due           | ✓（该 World 的 subject） | 可经 `notification.created` | `task_item` + inbox   |
| 任务**提前提醒**（可多条） |            ✗             |    ✓（直达，不经 Inbox）    | `task_item` reminders |
| `notification_send`        |            ✓             |  按收件 subject 需要打断时  | inbox                 |
| Chat 未读上升              |            ✗             |              ✓              | `conversation`        |
| 番茄钟阶段结束             |            ✗             |              ✓              | `pomodoro_session`    |

上表为目标态；现状 gap 见切面。番茄钟阶段结束**不写 inbox**；会话历史由 `pomodoro_session` entity 承担。

实现：`src/client/portal-sdk/local-reminder.ts` + `portal-sdk/alert/` + 各端 backend。

| 端          | 即时通道（无伴侣 / 非 desktop）                | 预登记                           |
| ----------- | ---------------------------------------------- | -------------------------------- |
| **desktop** | 伴侣气泡或 Tauri 桌面通知（`showNativeAlert`） | process；伴侣可见时跳过          |
| **web**     | Web Notification API                           | 页内 `setTimeout`（best-effort） |
| **mobile**  | Tauri Android 本地通知（`showNativeAlert`）    | schedule / cancel                |

---

（以下为 Inbox 专章，保留原行为说明。）

PG-backed in-app inbox for **user** and **agent** subjects (entity model). Cron job results, task **due**, env/health, and LLM tools write here; Shell UI lists and marks read via SAP. Advance reminders are not Inbox rows.

## Recipients

Subject entity ids are bound at Habitat boot into **`ResolvedWorldContext`** and persisted to `habitat_runtime_config.worlds` (see [`entity-model.md`](../product/entity-model.md)). Operators do **not** need to hand-maintain these ids on a new instance.

Optional override (advanced; rarely needed):

```yaml
# habitat_runtime_config (Shell → Habitat 服务设置 → worlds)，或冷启动后由 boot 自动回写
worlds:
  user_subject_id: 109 # type=user entity
  agent_subject_id: 110 # type=agent entity
```

Legacy `notifications.user_subject_id` / `agent_subject_id` are still read as fallback when `worlds` is unset.

`user_world_id` / `agent_world_id` are derived at Habitat boot from each subject's `default_private_world_id`.

Each row stores `recipient_kind` (`user` | `agent`) and `recipient_id` (entity id string from `ResolvedWorldContext`).

| Writer                                  | Typical recipient                             |
| --------------------------------------- | --------------------------------------------- |
| Cron success (when `notify_on_success`) | **both** user + agent                         |
| Cron failure                            | **both** user + agent                         |
| Task **due** (target)                   | subject of the task’s World                   |
| Env/health baseline change              | **both** user + agent (`builtin-env-health`)  |
| In-process builtin failure              | **both** user + agent（无 cron_log 时的替代） |
| `notification_send` tool                | user / agent / both; optional `subject_id`    |

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

## Task due / reminder discovery

**Target** (see [notification-and-reminder](../aspects/notification-and-reminder.md)): Habitat **sleep-until-next** (one next-fire timer). **Due** → Inbox for the entity’s World subject; **advance reminders** → local interrupt only. Do **not** use PG `cron_jobs` / `cron_log` for discovery.

**Current code:** `builtin-task-reminders` runs via in-process `Bun.cron` (`* * * * *`, no PG cron row / no empty-scan `cron_log`). Still transitional vs sleep-until-next; single `remind_at` with remind-else-due writes the user Inbox; scan walks `user_world_id` only.

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
- `notification.subscribeInbox` — WS；用户 Inbox 新建推送 `notification.created`（本机提醒）

No SAP create RPC in v1; writes are Habitat-internal + tools.

## Related

- Aspect (Notification / Reminder / Alert, Attention hub): [`notification-and-reminder.md`](../aspects/notification-and-reminder.md)
- Entity subjects: [`entity-model.md`](../product/entity-model.md)
