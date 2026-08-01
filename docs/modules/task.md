---
title: Task
---

# 任务模块

任务（`task_item`）与清单 / 智能清单 / 项目内任务共享同一实体组件；**重复任务**为滴答式 **A′**（live 系列头 + 完成历史），无独立模板实体。

## 与日历的边界（#14668）

- **Task** = 清单工作台：Inbox、清单树、自定义/内置智能清单、任务 CRUD、归档与排序
- **Calendar** = 跨模块时间视图/入口：聚合带时间的事件、任务 due、项目窗口；点击 overlay 或跳回本模块
- 智能清单**不**迁入日历；按时间浏览日常安排以日历为准（见 [calendar.md](./calendar.md)）

## 数据模型

### Live `task_item`

- 永远代表「当前期」：待办列表默认只查 **根任务**（`roots_only` / `parent_id` 空）。
- `body.parent_id`（可选）：一层子任务；子任务不可再挂子任务，也不可带 `recurrence`。
- `body.recurrence`（可选）：`freq` / `interval` / `anchor` / `weekdays?` / `until?` / `count?` / **`schedule_at`** / `skip?` / `workdays_only?` / `calendar?` / `lunar_month?` / `lunar_day?`。
- **显示与提醒**用顶层 `due_at`；**提前提醒**用 `reminders[]`（与兼容字段 `remind_at` = 最早一项同步）。
- **规则时钟**用 `recurrence.schedule_at`。
- 「仅此一次」改期：只改 `due_at`（及 remind 相对偏移），**不改** `schedule_at`。改规则轨：同时改 `due_at` 与 `schedule_at`（或显式 patch `recurrence`）。RPC：`only_this`（默认 false = 改规则轨；详情 UI 默认 true）。

### History `task_occurrence`

- 每期完成写一条不可变快照：`series_task_id` → live id；`completed_at` / `due_at` / 归属快照；`title`/`content` 复制当期。
- **双向关联**：live → `task.listOccurrences(series_task_id)`；occurrence → `series_task_id` 打开 live。
- 删除 live：**级联软删**其 occurrence 与子任务。

无 DDL（JSONB + `components[]`）。

## 完成语义（SSOT：`completeTaskItem`）

```
无 recurrence → status=completed + completed_at
有 recurrence → 写 task_occurrence；若 count/until 耗尽则清规则并 completed；
              否则按 anchor 推进 due_at + schedule_at，保持 pending，清 last_notified_at / 提醒 notified
skip → 只推进，不写 occurrence，不减 count
completeForever → 写 occurrence（若有规则）+ 清 recurrence + completed
```

所有入口必须收敛到上述语义：

| 入口                                  | 行为                                               |
| ------------------------------------- | -------------------------------------------------- |
| `task.complete` / LLM `task_complete` | → `completeTaskItem`                               |
| `task.patch({ status: completed })`   | 服务端委托 `completeTaskItem`                      |
| Offline 勾选完成                      | 出站 `task.complete`；有 recurrence 时本地乐观滚动 |

另：`task.skip` / `task.completeForever` / `task.listOccurrences`。

## 智能清单「已完成」

重复 live 完成后不再停留在 `completed`，故「今日/昨日完成」须 **并集**：

1. `task_item`（一次性已完成）
2. `task_occurrence`（重复打勾历史）

实现：`listCompletedActivity`（domain）；列表 RPC 在 `status=completed` + `completed_on*` 时走并集。occurrence 行：`id = series_task_id`，带 `occurrence_id`。

## 提醒

见 [`notification-and-reminder`](../aspects/notification-and-reminder.md)：

- **due** → Inbox Notification（`last_notified_at`）
- **advance**（`reminders[]`）→ WS `task.advanceReminder` → 本机 Alert（条目级 `last_notified_at`）
- Habitat：**sleep-until-next**（`task-reminder-scheduler`），不再每分钟 cron

## UI 视图

| 视图 | 说明                                                          |
| ---- | ------------------------------------------------------------- |
| 列表 | 默认；支持拖拽排序                                            |
| 看板 | `/tasks` 内切换；按优先级或状态分列，拖拽改字段；只显示根任务 |
| 详情 | 提醒 / 重复高级选项 / 一层子任务 checklist / 番茄专注         |

## v1 边界（non-goals）

- 不做独立 template 实体、预创建未来期、完整 RRULE
- 不做跨时区多日历；日界与现有任务筛选一致（Asia/Shanghai）
- 不做自然语言快速添加、习惯打卡、倒数日、清单协作、第三方日历同步
- 不做四象限 / 时间线甘特；项目文件夹级跨项目看板仍属后续

日历侧重复实例为 **虚拟展开**（见 [`calendar.md`](./calendar.md)），不写未来 `task_occurrence`。

## 相关代码

- Schema：`task-item.ts` / `task-occurrence.ts` / `task-recurrence.ts` / `schedulable.ts`
- Domain：`item-store.ts` / `occurrence-store.ts` / `completed-activity.ts`
- RPC：`src/shared/rpc-contract/frames/task.ts`
- 提醒调度：`src/host/platform/boot/task-reminder-scheduler.ts`
