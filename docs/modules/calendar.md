---
title: 日历
---

# 日历（事件日程）

跨模块**时间视图 / 入口**：自有 **事件**（`calendar_event`）+ 带**计划时间**的任务（清单/backlog 与项目内，含重复虚拟展开）+ 项目 **start_at/end_at**，经 `calendar.range` 聚合到月/周网格；**日 / 近三天 / 近七天**议程另并入仅有 `due_at` 的 pending 任务。开启「显示已完成」时另并入已完成任务（计划段与完成日双轴）。  
**不是**清单管理宿主——Inbox、清单树、智能清单规则与归档仍在 [任务](./task.md)。到期浏览与完成回顾以本模块为准（任务侧不再提供今天/明天/未来7天或今日/昨日/近7天完成等内置清单）。

## 与相关模块对照

| 能力         | 日历                                                 | 任务                                   | 项目           |
| ------------ | ---------------------------------------------------- | -------------------------------------- | -------------- |
| 自有时段条目 | `calendar_event` CRUD                                | —                                      | —              |
| 任务安排     | range 内展示计划区间；可选已完成双轴；点击 → overlay | 清单管理、计划/截止/提醒编辑、智能清单 | —              |
| 重复任务展开 | range 虚拟画出后续实例                               | A′ live + occurrence                   | —              |
| 项目窗口     | range 内展示相交项目；点击 → `/projects`             | —                                      | start/end 编辑 |
| 重复规则     | 事件不做                                             | 任务 recurrence                        | —              |
| 智能清单导航 | 不迁入（#14668 定论）                                | 宿主                                   | —              |
| 完成回顾     | 按完成日（可与计划段同显）                           | 自定义智能清单仍可用完成过滤           | —              |

### #14668 定论

- 日历 = 统一时间视图与入口（日常按时间浏览）
- 展示来源：日程事件、清单带日期任务、项目本身、项目内带日期任务；可选已完成任务
- 交互：点击 → 弹出层（entity overlay / 事件 Dialog）；需要完整上下文时跳转对应模块
- **不**把智能清单侧栏或清单 CRUD 搬进日历

## 数据形状

实体：`type=content`，`primary_component: calendar_event`，归属 subject 默认
private world（壳 `subject_kind`）。

| 字段                        | 位置      | 说明                                           |
| --------------------------- | --------- | ---------------------------------------------- |
| `title` / `content`         | entity 列 | 标题与备注                                     |
| `start_at`                  | body      | 必填 ISO8601（计划开始）                       |
| `end_at`                    | body      | 可空；空则瞬时点                               |
| `all_day`                   | body      | 全天                                           |
| `remind_at` / `reminders[]` | body      | 相对**开始**的提醒；`remind_at` 为最早一项镜像 |
| `last_notified_at`          | body      | Inbox 幂等                                     |
| `tag_ids`                   | entity 列 | 可选                                           |
| `client_op_id`              | body      | 离线幂等                                       |

时间基准：全局 `i18n.timezone`（IANA，默认 Asia/Shanghai）。事件**无** `due_at`。

## 栖息地 RPC

| 方法                                                    | 用途                                                             |
| ------------------------------------------------------- | ---------------------------------------------------------------- |
| `calendar.list` / `get` / `create` / `patch` / `delete` | 事件 CRUD                                                        |
| `calendar.convertToTask`                                | 同 id retype → `task_item`（默认 Inbox；有损丢弃 `all_day`）     |
| `calendar.range`                                        | `from`/`to` + 可选 `kinds[]` / `sources[]` / `include_completed` |
| `calendar.prefs.get` / `calendar.prefs.update`          | 日程显示偏好（独立 entity `calendar_ui_prefs`；按视图拆分）      |

反向：`task.convertToEvent`（见 [task.md](./task.md)）。形态约定见
[`entity-model.md`](../product/entity-model.md)。

`calendar.range` 规则：

- **event**：区间与 `[from,to]` 相交
- **task**：`status=pending` 根任务（**不**按 `in_backlog` 过滤：含清单/backlog
  与项目内）；**计划区间**（`start_at`/`end_at`）与查询窗相交，或带 `recurrence` 时在区间内 **虚拟展开**后续实例（`virtual:
true`，不写库）。独立 `due_at` 不作为日历条带终点。
- **`include_completed`**：另并入已完成根任务（清单 + 项目内；含 occurrence 历史）：计划与窗相交，**或** `completed_at` 落窗。同一 live id 只返回一条（保留计划字段 + `completed_at`）；前端按**计划段 + 完成日**双轴展示，同日去重。
- **project**：`status=active`，有 `start_at`，且与区间相交（不含已完成 / 搁置 / 取消）
- **holiday**：内置日历源合成的只读全天项（不写库、无提醒）。`kinds` 含 `holiday` 且未传 `sources` 时启用全部已实现源；按公历年懒加载并 Redis 缓存（`anima:cache:calendar:builtin:{source}:{year}`）。

### 内置日历源

| source          | 文案       | 内容                                                                                   |
| --------------- | ---------- | -------------------------------------------------------------------------------------- |
| `cn_holiday`    | 中国节假日 | 命名日（元旦、春节、清明、劳动节、端午、中秋、国庆等）；**不含**连休假期条与调休上班日 |
| `traditional`   | 传统节日   | 农历民俗白名单（元宵、七夕、重阳、腊八、除夕等）                                       |
| `international` | 国际节日   | 公历固定日（情人节、妇女节、愚人节、万圣节、平安夜、圣诞节等）                         |
| `solar_term`    | 二十四节气 | 全年节气日                                                                             |

同日同标题跨源去重。后续活动/佛教等日历可挂同一注册表、独立开关。

## 提醒

`task-reminder-scheduler`（睡到下次）扫描同时覆盖
`calendar_event`：`reminders[]`（相对开始；兼容 `remind_at` / 缺省=`start_at`）→ Inbox，`source_ref` =
`calendar_event:{id}:trigger:{iso}`。见
[notification-and-reminder](../aspects/notification-and-reminder.md)。

## 界面

- 工具栏：视图菜单、日期导航、**显示**（弹层：条目 / 内置日历 / 本视图：重复展开、显示已完成任务、显示已过期事件）、刷新、新建；固定用户 subject（不暴露 user/agent 切换）。

- **日视图**：单日议程，上一页/下一页按自然日切换（可到明天、后天）；「今天」跳回当日。正在看**今天**时顶部列出全部逾期 pending 任务（含项目内、仅有截止）。已过期事件由本视图开关控制。
- **近三天 / 近七天**：相对真实今天的滚动议程（3 / 7 个自然日）；第一组（今天）含逾期
- **月视图**：月网格按周行展示彩色**事件条**（跨日贯穿、同行 lane 错开；超出约 3 行显示 `+N`）+ 选中日议程；月格任务条**不**显示优先级色点；窄布局减小外边距以腾出格子空间
- **周视图**：周一至周日列，同样用跨列事件条；pending 任务可拖拽改**计划**（`task.patch` + `only_this: true`）；已完成不可拖
- **已完成双轴**：开启「显示已完成任务」后，同一任务可出现在计划日（段）与 `completed_at` 完成日；两轴同日只显示一次
- **着色**：按条目 kind（事件 / 任务 / 项目 / 节日）语义色区分，与议程徽章一致；已完成弱化/划线
- **显示偏好**：Habitat 独立配置块 `calendar_ui_prefs`（`calendar.prefs.get` / `update`），按视图拆分 kinds / 内置源 / 重复展开 / 已完成 / 已过期。前端**本地缓存优先**渲染，进入日程时刷新；改开关先写本地再同步 Habitat
- 窄布局工具栏开关使用更大触控尺寸；宽布局保持紧凑 `sm`
- 创建/编辑事件 Dialog。点击任务走 entity overlay；项目进 `/projects`；**节日只读**（轻提示，无编辑）。清单管理回 `/tasks`
- 月/周网格仍只画**计划**条带（独立 `due_at` 不当条带终点）；完成日若不在计划条内另画单日条；议程额外并入仅有截止的 pending 任务

## LLM ToolSet `calendar`

`calendar_list` / `calendar_create` / `calendar_update` / `calendar_delete`
/ `calendar_get` / `calendar_convert_to_task` / `calendar_range`；默认 caller
private world，可选 `world_id` / `subject_kind`。

## 非目标

- 年/多周视图、事件自身重复、第三方日历订阅（内置日历源为本地合成，不是 ICS 订阅）
