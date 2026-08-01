---
title: Calendar
---

# Calendar（事件日程）

跨模块**时间视图 / 入口**：自有 **事件**（`calendar_event`）+ 带 `due_at` 的任务（清单/backlog 与项目内，含重复虚拟展开）+ 项目 **start_at/end_at**，经 `calendar.range` 聚合到月/周/日视图。  
**不是**清单管理宿主——Inbox、清单树、智能清单规则与归档仍在 [Task](./task.md)。

## vs 相关模块

| 能力         | Calendar                                             | Task                                | Project        |
| ------------ | ---------------------------------------------------- | ----------------------------------- | -------------- |
| 自有时段条目 | `calendar_event` CRUD                                | —                                   | —              |
| 任务到期     | range 内展示 pending due；点击 → overlay / 可跳 Task | 清单管理、due/remind 编辑、智能清单 | —              |
| 重复任务展开 | range 虚拟画出后续实例                               | A′ live + occurrence                | —              |
| 项目窗口     | range 内展示相交项目；点击 → `/projects`             | —                                   | start/end 编辑 |
| 重复规则     | 事件不做                                             | task recurrence                     | —              |
| 智能清单导航 | 不迁入（#14668 定论）                                | 宿主                                | —              |

### #14668 定论

- 日历 = 统一时间视图与入口（日常按时间浏览）
- 展示来源：日程事件、清单带日期任务、项目本身、项目内带日期任务
- 交互：点击 → 弹出层（entity overlay / 事件 Dialog）；需要完整上下文时跳转对应模块
- **不**把智能清单侧栏或清单 CRUD 搬进日历

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
- **task**：`status=pending` 根任务（**不**按 `in_backlog` 过滤：含清单/backlog 与项目内）；live `due_at` 落在区间，或带 `recurrence` 时在区间内 **虚拟展开**后续实例（`virtual: true`，不写库）
- **project**：有 `start_at`，且与区间相交

## 提醒

`task-reminder-scheduler`（sleep-until-next）扫描同时覆盖 `calendar_event`：`remind_at` 优先，否则 `start_at`；写 Inbox，`source_ref` = `calendar_event:{id}:trigger:{iso}`。见 [notification-and-reminder](../aspects/notification-and-reminder.md)。

## UI

Shell `/calendar`：单行工具栏（月/周导航、kinds、重复展开、刷新、新建）；固定用户 subject（不暴露 user/agent 切换）。

- **月视图**：月网格 + 选中日议程
- **周视图**：周一至周日列；pending 任务可拖拽改 `due_at`（`task.patch` + `only_this: true`）
- **重复展开**开关：控制是否显示虚拟重复实例
- 创建/编辑事件 Dialog。点击任务走 entity overlay；项目进 `/projects`。清单管理回 `/tasks`

## LLM ToolSet `calendar`

`calendar_list` / `calendar_create` / `calendar_update` / `calendar_delete` / `calendar_get` / `calendar_range`；默认 caller private world，可选 `world_id` / `subject_kind`。

## Non-goals

- 年/多周视图、事件自身重复、第三方日历订阅
