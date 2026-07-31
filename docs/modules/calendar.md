---
title: Calendar
---

# Calendar（事件日程）

统一时间出口：自有 **事件**（`calendar_event`）+ 任务 **due_at** + 项目 **start_at/end_at**，经 `calendar.range` 聚合到月/日视图。

## vs 相关模块

| 能力         | Calendar                 | Task                | Project        | 后续 #14668              |
| ------------ | ------------------------ | ------------------- | -------------- | ------------------------ |
| 自有时段条目 | `calendar_event` CRUD    | —                   | —              | —                        |
| 任务到期     | range 内展示 pending due | 智能清单 / due 编辑 | —              | 是否迁智能清单导航到日历 |
| 项目窗口     | range 内展示相交项目     | —                   | start/end 编辑 | —                        |
| 重复规则     | 不做                     | #14574              | —              | —                        |

## 数据形状

Entity：`type=content`，`primary_component: calendar_event`，归属 subject 默认 private world（Shell `subject_kind`）。

| 字段                             | 位置      | 说明                               |
| -------------------------------- | --------- | ---------------------------------- |
| `title` / `content`              | entity 列 | 标题与备注                         |
| `start_at`                       | body      | 必填 ISO8601                       |
| `end_at`                         | body      | 可空；空则按瞬时点 / 与 start 同日 |
| `all_day`                        | body      | 全天                               |
| `remind_at` / `last_notified_at` | body      | 与 task `schedulable` 同语义       |
| `tag_ids`                        | entity 列 | 可选                               |
| `client_op_id`                   | body      | 离线幂等                           |

时间基准：CST（Asia/Shanghai），与全仓一致。

## Habitat RPC

| 方法                                                    | 用途                                                         |
| ------------------------------------------------------- | ------------------------------------------------------------ |
| `calendar.list` / `get` / `create` / `patch` / `delete` | 事件 CRUD                                                    |
| `calendar.range`                                        | `from`/`to` + 可选 `kinds[]`：`event` \| `task` \| `project` |

`calendar.range` 规则：

- **event**：区间与 `[from,to]` 相交
- **task**：`status=pending` 且 `due_at` 落在区间（含 backlog 与项目任务）
- **project**：有 `start_at`，且与区间相交

## 提醒

`builtin-task-reminders` 扫描同时覆盖 `calendar_event`：`remind_at` 优先，否则 `start_at`；写 Inbox，`source_ref` = `calendar_event:{id}:trigger:{iso}`。见 [notification-and-reminder](../aspects/notification-and-reminder.md)。

## UI

Shell `/calendar`：月网格 + 选中日议程；kinds 筛选；创建/编辑事件 Dialog。点击任务走 entity overlay；项目进 `/projects`。

## LLM ToolSet `calendar`

`calendar_list` / `calendar_create` / `calendar_update` / `calendar_delete` / `calendar_get` / `calendar_range`；默认 caller private world，可选 `world_id` / `subject_kind`。
