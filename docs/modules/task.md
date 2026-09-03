---
title: 清单
---

# 清单模块

产品名 **清单模块**（原「任务模块」）；壳 `ShellModuleId`=`tasks`、feature id 仍 `task`、路由 `/tasks`。任务（`task_item`）与清单 / 智能清单 / 项目内任务共享同一实体组件；**重复任务**为滴答式 **A′**（live 系列头 +
完成历史），无独立模板实体。

**任务容器**（`TaskContainer`）：清单侧 `list` / 项目侧 `project` / 跨容器 `any`。清单模块列表入口默认 `container=list`；日程等跨模块查询用 `any`。≠ 壳模块、≠ 组件 id（见 [glossary](../../i18n/glossary.md)）。

## 与日历的边界（#14668）

- **清单模块** = 清单工作台：Inbox、清单树、自定义智能清单、任务 CRUD、归档与排序
- **Calendar** = 跨模块时间视图/入口：聚合事件、带计划的任务、仅有截止的任务（议程）、项目窗口；并可按完成日回顾已完成任务；点击 overlay 或跳回本模块
- 智能清单**不**迁入日历；按时间浏览与完成回顾以日历为准（见 [calendar.md](./calendar.md)）

## 数据模型

### 当期 `task_item`

- 永远代表「当前期」：待办列表默认只查 **根任务**（`roots_only` / `parent_id` 空）。
- `body.parent_id`（可选）：一层子任务；子任务不可再挂子任务，也不可带 `recurrence`。
- **两类时间**：
  - **计划**：`start_at` + `end_at`（单点：仅 `start_at`，`end_at=null`；时段：两者且
    `start_at` ≤ `end_at`）。日历条带按计划区间展示。
  - **截止（deadline）**：独立 `due_at`（项目场景常用）；Inbox「到期」**仅**看本字段。
- **硬约束**：无计划且无 `due_at` → 禁止提醒；**重复**另需计划时间（`end_at ?? start_at` 为计划时钟）。清全部时间时级联清除提醒/重复。
- `body.recurrence`（可选）：`freq` / `interval` / `anchor` / `weekdays?` /
  `until?` / `count?` / **`schedule_at`** / `skip?` / `workdays_only?` /
  `calendar?` / `lunar_month?` / `lunar_day?`。
  - `calendar=lunar` 仅支持 `monthly` / `yearly`：月重复必填
    `lunar_day`（按农历月推进同日）；年重复必填 `lunar_month` + `lunar_day`（闰月 `lunar_month`
    为负，与 lunar-javascript 一致）。
- **多提醒** `reminders[]`：每条 `{ at, anchor?: start|end|due, last_notified_at? }`；兼容字段
  `remind_at` = 最早一项。Advance → 仅本机 Alert；到期 Inbox 仍只绑 `due_at`。
- **规则时钟**用 `recurrence.schedule_at`（绑计划时钟）。
- 「仅此一次」改期：只改计划（及按锚点平移的 remind），**不改** `schedule_at`。改规则轨：同时改计划与
  `schedule_at`。RPC：`only_this`（默认 false = 改规则轨；详情 UI 默认 true）。
- 时区：全局 `i18n.timezone`（IANA，默认 `Asia/Shanghai`）；设置面板可改。

### 历史 `task_occurrence`

- 每期完成写一条不可变快照：`series_task_id` → live id；`completed_at` / `due_at` /
  归属快照；`title`/`content` 复制当期。
- **双向关联**：live → `task.listOccurrences(series_task_id)`；occurrence →
  `series_task_id` 打开 live。
- 删除 live：**级联软删**其 occurrence 与子任务。

无 DDL（JSONB + `components[]`）。

## 完成语义（SSOT：`completeTaskItem`）

```
无 recurrence → status=completed + completed_at
有 recurrence → 写 task_occurrence；若 count/until 耗尽则清规则并 completed；
              否则按计划时钟推进 start/end（及 due）+ schedule_at，保持 pending，清 last_notified_at / 提醒 notified
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

## 智能清单

内置完成类（今日/昨日/最近7天完成）已退役；完成回顾在 [日历](./calendar.md)（按完成日，可与计划段同显）。到期浏览仍在日历日视图与近三天/近七天。自定义智能清单仍可配置到期与完成时间条件。默认打开任务落到收件箱。

## 智能清单「已完成」

重复 live 完成后不再停留在 `completed`，故自定义完成类过滤须 **并集**：

1. `task_item`（一次性已完成）
2. `task_occurrence`（重复打勾历史）

实现：`listCompletedActivity`（domain）；列表 RPC 在 `status=completed` +
`completed_on*` / `completed_after`/`completed_before` 时走并集。occurrence 行：`id = series_task_id`，带 `occurrence_id`。日程 `calendar.range`（`include_completed`）亦复用该并集。

## 提醒

见 [`notification-and-reminder`](../aspects/notification-and-reminder.md)：

- **due** → Inbox Notification（`last_notified_at`）
- **advance**（`reminders[]`）→ WS `task.advanceReminder` → 本机 Alert（条目级
  `last_notified_at`）
- Habitat：**sleep-until-next**（`task-reminder-scheduler`），不再每分钟 cron

## UI 视图

| 视图 | 说明                                                                                          |
| ---- | --------------------------------------------------------------------------------------------- |
| 列表 | 默认；支持拖拽排序                                                                            |
| 看板 | `/tasks` 内切换；按优先级或状态分列，拖拽改字段；只显示根任务                                 |
| 详情 | 计划（单点/时段切换）/ 截止 due / 多锚点提醒 / 重复高级选项 / 一层子任务 checklist / 番茄专注 |

## 滴答清单 CSV 导入（有损、一次性）

- 入口：栖息地 **数据维护**（`/data-maintenance`）→「从滴答清单导入」；RPC `task.importDidaCsv`。
- **两步**：选 CSV → 本地预览大表（Tab：正常导入 / 警告 / 跳过）→ 确认后写入。
- 源：滴答 Web CSV 备份（Version 7.x）；幂等 `client_op_id = dida:<taskId>` /
  `dida:list:…` / `dida:folder:…`。
- Status `-1`（放弃）跳过；`0`→pending、`2`→completed。
- **无 due** → 丢提醒与重复；已完成任务不保留 recurrence。
- `Reminder`：ISO8601 duration → 相对 due 的绝对 `reminders[]`（可多条）。
- `Repeat`：支持常见 RRULE
  子集（`FREQ`/`INTERVAL`/`BYDAY`/`BYMONTHDAY`/`UNTIL`/`COUNT`/`LUNAR:`/`TT_SKIP`）；`ERULE`/`BYDATE`
  自定义不映射并记警告。
- 不做持续同步、不导入看板 Column。

## v1 边界（非目标）

- 不做独立 template 实体、预创建未来期、**完整通用 RRULE**（滴答 CSV 常见子集见上）
- 日界与写入 offset 由全局 `i18n.timezone` 决定（默认 Asia/Shanghai）；不做每事件自带时区 / 多日历
- 不做自然语言快速添加、**清单内**习惯打卡（独立模块见 [habit.md](./habit.md)）、倒数日、清单协作、第三方日历**持续**同步
- 不做四象限 / 时间线甘特；项目文件夹级跨项目看板仍属后续

日历侧重复实例为 **虚拟展开**（见 [`calendar.md`](./calendar.md)），不写未来 `task_occurrence`。

## 与日历事件互转（retype）

- `task.convertToEvent`：同 id 将 pending 根任务（须有**计划时间** `start_at`）换成
  `calendar_event`；计划 1:1；有损丢弃 recurrence / 归属 / **deadline** / 子任务（级联软删）与 occurrence。
- 反向见 [`calendar.md`](./calendar.md) `calendar.convertToTask`。
- 形态约定见 [`entity-model.md`](../product/entity-model.md) Morph（retype /
  attach）。

## 任务 facet（非 primary）

清单 / complete / 提醒 / `calendar.range` 认 **`components` 含
`task_item`**（例如邮件挂载）。`task.delete` 在 primary≠`task_item` 时只 **detach**
组件（前后端共用 `taskDeleteDetachesCarrier`；列表行带
`primary_component`，确认文案区分「移除任务」与软删实体）。

## 相关代码

- Schema：`task-item.ts` / `task-occurrence.ts` / `task-recurrence.ts` /
  `schedulable.ts`
- Domain：`item-store.ts` / `occurrence-store.ts` / `completed-activity.ts` /
  `dida-csv-import.ts` / `dida-rrule.ts` / `apply-dida-import.ts`
- 互转 mapper：`features/calendar/domain/convert-task-event.ts`
- RPC：`packages/shared/rpc-contract/frames/task.ts`（含
  `task.importDidaCsv`、`task.convertToEvent`）
- 提醒调度：`packages/habitat/platform/boot/task-reminder-scheduler.ts`
- 导入 UI：栖息地 `data-maintenance` + `DidaImportDialog`
