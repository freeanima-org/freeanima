---
title: 通知
---

# 通知

代码里 **`notification*`** 指 **Inbox（收件箱）**；瞬时打断使用 **`alert*`** /
`deliverLocalReminder`。产品上的 **通知 / 提醒 / 本机打断** 三分法、任务 due vs 多提醒、栖息地
**睡到下次** 时间发现、壳层 Attention 集中订阅 → 切面
[`notification-and-reminder.md`](../aspects/notification-and-reminder.md)。

## Inbox（收件箱）

面向 **user** 与 **agent** subject（实体模型）的 PG 应用内收件箱。Cron 任务结果、**任务 due**（目标）、环境/健康变化与 LLM 工具写入此处；壳 UI 经 SAP 列表与标已读。任务提前提醒**不是** Inbox 行 — 见切面。

## Alert（本机提醒，仅本机）

三分法词汇（Notification / Reminder / Alert）见切面
[`notification-and-reminder.md`](../aspects/notification-and-reminder.md)「中文词汇对照」——**Alert
= 真响到设备上**，与 Inbox、任务闹钟意图无关。

**不写 PG、不做跨设备认领。** 各壳端在启动时注册 `AlertBackend`（web / desktop / mobile）。产品提醒统一经 `portal-sdk/local-reminder` 的 **`deliverLocalReminder`**：

| 本机条件                                        | 通道                                    |
| ----------------------------------------------- | --------------------------------------- |
| desktop 且伴侣窗口显示（`getCompanionVisible`） | `enqueueCompanionBubble`（不弹本机 OS） |
| 否则（含 web / mobile）                         | `deliverAlert`（系统通知）              |

多端策略为**宽松**：各入口独立提醒；伴侣打开 ≠ 人在旁，**不**因此压制手机/Web。同端在源路由 focused 时可用
`suppressOsWhenFocused` 压制 OS。伴侣气泡**不**视为已读/ack。

Alert 分两档（同一契约，成对）：

| 档         | API                                              | 含义                             |
| ---------- | ------------------------------------------------ | -------------------------------- |
| **即时**   | `deliverLocalReminder` → `deliverAlert` / bubble | 现在立刻提示                     |
| **预登记** | `scheduleLocalAlert` / `cancelScheduledAlert`    | 在未来时刻本机弹；**必须可取消** |

硬约束：**schedule ⊕ cancel 成对**。只登记不能取消 = 不可用（暂停/手动中止后仍会到点骚扰）。同 `tag` 再
`schedule` = replace（先 cancel 再登记）；`cancel` 对不存在的 id/tag **幂等成功**。

用户 Inbox 新建经 `notification.subscribeInbox` → `notification.created` 推到各端，再走
`deliverLocalReminder`。Chat
未读会话数上升同理（`ChatUnreadShellWatcher`）。`subscribeInbox` 的 pump 与 chat 一样绑定
栖息地 RPC **WS 会话**（断线 abort，重连后可重建）；勿用进程级单例 Map，否则重连后推送会静默丢失而
`notification.list` 仍正常。

### 三壳 durability

| 壳          | `scheduleDurability` | 预登记存活边界                                            |
| ----------- | -------------------- | --------------------------------------------------------- |
| **mobile**  | `os`                 | 杀进程后 OS 仍可按 `at` 弹出（Local Notifications）       |
| **desktop** | `process`            | 应用未退出（托盘存活）即可；关主窗口仍响；`quit` 后不保证 |
| **web**     | `process`（页进程）  | **best-effort**：标签页存活才准；关标签即丢               |

### 番茄钟

**例外（栖息地同步，非 Alert）**：运行中活跃态（`pomodoro_active` + `pomodoro.active.*`）跨端 **last-write-wins**；**阶段结束本机提醒仍仅本机**（`deliverLocalReminder`）。多端同步靠 `put` / `clear` 后的 `pomodoro.active.changed`；重连与页面可见时 `active.get` 兜底，**不作周期轮询**。

阶段开始 / 继续时：伴侣**未**显示则 `scheduleLocalAlert`（`phaseEndsAt`）；伴侣显示时**不**预登记（OS
定时器无法走气泡），靠 `PomodoroShellWatcher`
即时路径气泡。暂停、**手动取消进行中会话**（`runPhaseAbort`）、阶段完成等路径
`cancelScheduledAlert`。伴侣显隐切换时重新 sync 预登记。

| 事件                       |      Inbox（目标）       |          本机打断           | SSOT                  |
| -------------------------- | :----------------------: | :-------------------------: | --------------------- |
| 任务**到期** due           | ✓（该 World 的 subject） | 可经 `notification.created` | `task_item` + inbox   |
| 任务**提前提醒**（可多条） |            ✗             |    ✓（直达，不经 Inbox）    | `task_item` reminders |
| `notification_send`        |            ✓             |  按收件 subject 需要打断时  | inbox                 |
| Chat 未读上升              |            ✗             |              ✓              | `conversation`        |
| 番茄钟阶段结束             |            ✗             |              ✓              | `pomodoro_session`    |

上表为目标态；现状 gap 见切面。番茄钟阶段结束**不写 inbox**；会话历史由 `pomodoro_session` entity 承担。

实现：`packages/frontend/client/portal-sdk/local-reminder.ts` + `portal-sdk/alert/` + 各端
backend。

| 端          | 即时通道（无伴侣 / 非 desktop）                                                                                      | 预登记                           |
| ----------- | -------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| **desktop** | 伴侣气泡或 Tauri 桌面通知（`showNativeAlert`）                                                                       | process；伴侣可见时跳过          |
| **web**     | Web Notification API                                                                                                 | 页内 `setTimeout`（best-effort） |
| **mobile**  | Tauri Android 本地通知（`showNativeAlert`）；runtime 权限 + channel `freeanima.reminders`（High 横幅 / Public 锁屏） | schedule / cancel                |

---

（以下为 Inbox 专章。）

面向 **user** 与 **agent** subject（实体模型）的 PG 应用内收件箱。Cron 任务结果、任务 **due**、环境/健康与 LLM 工具写入此处；壳 UI 经 SAP 列表与标已读。提前提醒不是 Inbox 行。

## 收件人

Subject 实体 id 在栖息地启动时绑定进内存 **`ResolvedWorldContext`**（唯一 user + commons；默认聊天 Anima 在 `chat.default_agent_subject_id`）。**已废除** `habitat_runtime_config.worlds` 持久化段；新实例上运维不必手工维护这些 id。

通知以 **`recipient_id`（subject 实体 id）** 为准；写入方应显式传入目标 subject，勿依赖「隐式默认 agent」。

`user_world_id` 由唯一 user 的 `default_private_world_id` 推导；agent 私有 world 按具体 `subject_id` 解析。

每行存储 `recipient_kind`（`user` | `agent`）与 `recipient_id`
（实体 id 字符串）。

| 写入方                              | 典型收件人                                      |
| ----------------------------------- | ----------------------------------------------- |
| Cron 成功（当 `notify_on_success`） | **双方** user + agent                           |
| Cron 失败                           | **双方** user + agent                           |
| 任务 **due**（目标）                | 任务所属 World 的 subject                       |
| 环境/健康基线变化                   | **双方** user + agent（`builtin-env-health`）   |
| 进程内 builtin 失败                 | **双方** user + agent（无 `cron_log` 时的替代） |
| `notification_send` 工具            | user / agent / both；可选 `subject_id`          |

梦境流水线**不会**创建通知（提醒已移除）。

## Agent 意识

未读的 agent 通知在推理时通过仅运行时的 **`assistant(name=notification_context)`**
**回合内注入**，位置在最后一条 `user` 消息之前。它们**不会**持久化到对话消息中。

注入块包含**处理协议**（按是否需要行动三分流——而非按 `source_kind`）。

### Agent 处理协议

对每条注入的 `[id:…]` 行，按内容分类（而非按写入方/来源）：

| 类别                                                   | 行动                                         | 标已读                                        |
| ------------------------------------------------------ | -------------------------------------------- | --------------------------------------------- |
| **仅信息**                                             | 有用则在回复中确认                           | 批量 `notification_mark_read({ ids: [...] })` |
| **需行动，可快速完成**                                 | 约 3 次**工具轮次**内处理完                  | 完成后对该 id 调 `notification_mark_read`     |
| **需行动，慢/不确定**                                  | 长任务前先问用户                             | 批准并处理完之前 **不要** 标已读              |
| **自我层维护提案**（`source_ref=self-layer-proposal`） | 问伙伴；批准则 `self_update_block`；否则丢弃 | 仅在 accept+写入或明确拒绝后标已读            |

未标已读的未读项会在下一用户回合再次注入。若注入块被截断，可用
`notification_list(recipient=agent, read_filter=unread)`（必须指定 recipient 或
`subject_id`）。

## LLM 工具（ToolSet `notification`）

经 `toolset_load` 加载 `notification`。

| 工具                     | 范围参数                                                                                                |
| ------------------------ | ------------------------------------------------------------------------------------------------------- |
| `notification_send`      | 可选 `subject_id`（覆盖 `target`）；省略 `subject_id` 时 **`target` 必填**（`user` / `agent` / `both`） |
| `notification_list`      | 可选 `subject_id`（覆盖 `recipient`）；省略 `subject_id` 时 **`recipient` 必填**（`user` / `agent`）    |
| `notification_mark_read` | 仅通知 id（全局）                                                                                       |

`subject_id` 必须是系统提示 / `ResolvedWorldContext` 中配置的 `user_subject_id` 或
`agent_subject_id`。

## 任务 due / 提醒发现

**目标态**（见 [notification-and-reminder](../aspects/notification-and-reminder.md)）：栖息地
**睡到下次**（一个下次触发定时器）。**Due** → 实体 World subject 的 Inbox；**提前提醒** → 仅本机打断。发现路径**不要**用 PG `cron_jobs` / `cron_log`。

**当前代码：** `builtin-task-reminders` 经进程内 `Bun.cron` 运行（`* * * * *`，无 PG cron 行 / 无空扫 `cron_log`）。相对睡到下次仍属过渡；单一 `remind_at` 在 remind-else-due 时写入用户 Inbox；扫描仅走 `user_world_id`。

## 工具

ToolSet `notification`：

- `notification_send`
- `notification_list`
- `notification_mark_read` — `id` 或 `ids`（批量，最多 20）

注册后包含在默认对话 toolset 中。

## SAP（读）

- `notification.list` — 需要 `recipient_kind` + 可选 `recipient_id`
- `notification.markRead`
- `notification.recipients` — UI 标签页用的已配置主体 id
- `notification.subscribeInbox` — WS；用户 Inbox 新建推送
  `notification.created`（本机提醒）

v1 无 SAP 创建 RPC；写入由栖息地内部 + 工具完成。

## 相关文档

- 切面（通知 / 提醒 / 本机打断，Attention 集中订阅）：
  [`notification-and-reminder.md`](../aspects/notification-and-reminder.md)
- 实体 subject：[`entity-model.md`](../product/entity-model.md)
