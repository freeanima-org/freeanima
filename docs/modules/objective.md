---
title: 目标管理
---

# 目标模块（规格 v1）

个人多层级目标 / 规划，位于**项目之上**：回答「要达成什么」，执行仍落在清单、项目、任务、日程等既有面。

**命名：** 产品名「目标」；组件 / feature / RPC 为 `objective`。**禁止**使用裸 `goal`（已占用为[会话便签](./goal.md)）。UI **不**品牌化 OKR；子节点文案用「子目标」。

## 概念层级

```text
objective（可嵌套 parent_id）
  ├── completion（完成标准）
  └── links → project | task_item | task_list | calendar_event（弱引用导航）
project → task_item
```

`links` 供跳转；自动统计用的 id 列表在 `completion.source`，职责分离。

## 生命周期 `status`

| 值            | 中文   | 说明                                     |
| ------------- | ------ | ---------------------------------------- |
| `not_started` | 未开始 | 默认新建                                 |
| `in_progress` | 进行中 |                                          |
| `completed`   | 已完成 | 用户手工改状态；**不**因进度达标自动翻转 |
| `cancelled`   | 已取消 |                                          |
| `on_hold`     | 暂停   |                                          |

`objective.list` 默认只返回 `not_started` + `in_progress`；`include_inactive: true` 可含其余状态。

## 完成标准 `completion`

```text
qualitative          非量化：靠 status + content
metric_manual        手工量化（如跑量 100km）：unit / target / current
metric_auto          可自动统计
  ├── tasks_completed
  ├── projects_completed
  ├── children_completed（直系子目标；已取消不计分母；读侧现算）
  ├── pomodoro（窗口内 session 次数或分钟；可选 task_ids）
  └── habit（schema 预留；写入时拒绝「习惯模块未落地」）
```

读接口附带计算字段 `resolved_progress`（**不**写回 body）：`current` / `target` / `unit` / `ratio` / `source`。

## `client_op_id`

可选离线幂等键：`string`（非强制 UUID），存 **`entities.client_op_id`**；仅 create 写 RPC 传入。见 [`offline-platform.md`](../aspects/offline-platform.md)。

## 数据模型

| 位置   | 字段                             | 说明                  |
| ------ | -------------------------------- | --------------------- |
| entity | `title` / `content`              | 标题；说明 / 成功叙事 |
| body   | `parent_id`                      | 嵌套；防环            |
| body   | `status` / `start_at` / `end_at` | 生命周期与可选周期    |
| body   | `completion` / `links`           | 完成标准；导航链接    |
| body   | `sort_order`                     | 排序                  |
| 顶层列 | `client_op_id`                   | 离线幂等              |

删除目标时**一并软删**全部子孙目标。链接目标不删执行实体。

## UI

壳模块 `objectives`，路由 `/objectives`（Rail「目标」）。创建时可选手动 / 自动完成类型；习惯入口不提供。

列表项快捷菜单（pointer：右键 ContextMenu；touch：⋯ / 长按 ActionSheet）：调整 `status`、添加子目标（预填 `parent_id`）。

## Habitat RPC

可选 `subject_kind: user | agent`。传输：`POST|WS /rpc/v1`。

| 方法                         | 用途                                                       |
| ---------------------------- | ---------------------------------------------------------- |
| `objective.list`             | 列表（默认可筛选 parent / status；含 `resolved_progress`） |
| `objective.get`              | 详情                                                       |
| `objective.create` / `patch` | 建改（含 completion）                                      |
| `objective.delete`           | 软删（含子树）                                             |
| `objective.link` / `unlink`  | 增删导航 `links`                                           |

实现：`packages/habitat/features/objective/`；UI：`packages/frontend/features/objective/`。

## 非目标（v1）

- 习惯实体 / 健身 App 自动采集
- 进度达标自动 `status → completed`
- O / KR 双实体；里程碑复活
- 跨 world 共享目标
- 复杂番茄标签 DSL
