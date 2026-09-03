---
title: 习惯
---

# 习惯模块（规格 v1）

个人习惯打卡：养成 / 戒除、三种记录方式、时段分组、统计与补记、多点提醒，并对接[日程](./calendar.md)与[目标](./objective.md)。产品对标滴答清单习惯面（不含会员限额 / OS 小组件 / 第三方同步）。

**命名：** 产品名「习惯」；壳 `ShellModuleId`=`habits`；组件 / feature / RPC 为 `habit`；打卡记录组件 `habit_check_in`。

## 概念

```text
habit（活习惯）
  └── habit_check_in（按自然日一条；宿主 i18n.timezone 的 YYYY-MM-DD）
```

打卡动作按极性不同：

| 极性            | 产品动作 | `amount` 含义 | 达标                               |
| --------------- | -------- | ------------- | ---------------------------------- |
| `build`（养成） | 打卡     | 当日完成量    | `amount >= target`（无记录未达标） |
| `break`（戒除） | 记一次   | 当日发生量    | `amount <= target`（无记录达标）   |

## 数据模型

无独立 DDL（JSONB + `components[]`）。

### `habit`

| 字段                                | 说明                                                                           |
| ----------------------------------- | ------------------------------------------------------------------------------ |
| `polarity`                          | `build` \| `break`                                                             |
| `record_mode`                       | `boolean`（完成全部 / 严格零次）\| `auto`（每次固定量）\| `manual`（手输量）   |
| `target` / `unit` / `auto_amount`   | 养成=日目标；戒除=日上限。`boolean`+养成 `target=1`；`boolean`+戒除 `target=0` |
| `frequency`                         | `daily`/`weekly` + `interval` + 可选 `weekdays` / `anchor_day`                 |
| `day_section`                       | `morning` \| `afternoon` \| `evening` \| `other`                               |
| `reminders[]`                       | `{ time: "HH:mm" }` 当日多点                                                   |
| `enable_journal` / `check_in_style` | 日志开关；`check` \| `stamp`                                                   |
| `status`                            | `active` \| `archived`                                                         |
| `sort_order` / `color?` / `icon?`   | 排序与展示                                                                     |

### `habit_check_in`

| 字段            | 说明                               |
| --------------- | ---------------------------------- |
| `habit_id`      | 所属习惯                           |
| `day`           | 自然日                             |
| `amount`        | 当日累计量（养成=完成；戒除=发生） |
| `mood` / `note` | 可选心情与日志                     |
| `checked_at`    | 最近写入 ISO                       |

达标谓词见上表（`isHabitDayMet`）。同一 `habit_id`+`day` 仅一条。

## 完成语义

| `record_mode` | `habit.checkIn`                                                        |
| ------------- | ---------------------------------------------------------------------- |
| `boolean`     | 养成：置 `amount = target`；戒除：置 `amount = target + 1`（刚超上限） |
| `auto`        | `amount += auto_amount`（可多次）                                      |
| `manual`      | `amount += amount_delta`（必填）                                       |

可补 `day` 做补记；`undoCheckIn` 撤销全日或回退量。删除习惯时级联软删其 check-in。

## Habitat RPC

| 方法                                                 | 用途                         |
| ---------------------------------------------------- | ---------------------------- |
| `habit.list` / `get` / `create` / `patch` / `delete` | CRUD；list 默认 `active`     |
| `habit.reorder`                                      | 同 section 内排序            |
| `habit.archive` / `unarchive`                        | 归档 / 恢复                  |
| `habit.checkIn` / `undoCheckIn`                      | 打卡 / 撤销                  |
| `habit.listCheckIns`                                 | 按习惯 + 日期窗              |
| `habit.stats`                                        | 总天数、连续、本月、月度格子 |
| `habit.presets`                                      | 内置习惯库（静态）           |

实现：`packages/habitat/features/habit/`；UI：`packages/frontend/features/habit/`。

## UI

壳路由 `/habits`（Rail「习惯」）。主列表按时段分组 + 拖拽排序；详情含月度打卡表、补记、编辑、归档；统计页周/月概览；习惯库一键创建。

## 与日程 / 目标

- `calendar.range` kind=`habit`：区间内应打卡日展开；prefs「显示打卡」
- 目标 `completion.source.type=habit`：窗内达标日数
- 番茄 session 可选 `habit_id`（与 task/event 互斥倾向）

## 提醒

`reminders[]` 按宿主时区拼当日 ISO，由任务提醒扫描一并写入 Inbox；`source_ref`=`habit:{id}:time:{HH:mm}:{day}`。

## 非目标（v1）

- 会员限额、OS 桌面小组件、第三方习惯 App 同步
- 清单智能清单内嵌习惯（日程议程承担「今天」展示）
- 农历频率
