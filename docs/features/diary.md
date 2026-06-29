---
title: Diary
---

# Diary（日记）

用户与 Agent 的结构化日记，基于 [Unified Entity Model](../concepts/entity-model.md) 的 `diary_entry` 组件。

## 与记忆系统的区别

| 能力     | 日记                                 | 自传叙事（autobiographical） |
| -------- | ------------------------------------ | ---------------------------- |
| 来源     | 用户 / Agent **主动撰写**            | 轻睡眠从对话**提取**         |
| 存储     | `entities` + `diary_entry`           | `autobiographical_memory` 表 |
| 编辑     | 可更新、可删除                       | append-only                  |
| 命名空间 | subject 的 **default private world** | 数字生命记忆管线             |

## User / Agent 隔离

- 用户日记与 Agent 日记分别存放在 `config.yaml` 中 `notifications.user_subject_id` / `agent_subject_id` 对应 subject 的 **default private world**。
- Shell `/diary` 顶栏可切换 **用户 / Agent** 视图。
- Agent LLM 工具（ToolSet `diary`）固定写入 **Agent** 私有 world。

## Agent 工具（ToolSet `diary`）

通过 `toolset_load` 加载 `diary` 后可使用。Agent 工具面按 **`date`（YYYY-MM-DD）** 定位条目，**缺省为今天**（CST 正午 `…T12:00:00+08:00`）；**不提供 `diary_create`**，写入请用 `diary_append`（当日无条目时自动创建空壳再追加）。

| 工具           | 说明                                                                     |
| -------------- | ------------------------------------------------------------------------ |
| `diary_append` | 向指定日追加正文（`\n\n` 分隔）；无条目则先建空壳；`tags` 仅在建壳时生效 |
| `diary_update` | 按日整段/字段替换（非 append）                                           |
| `diary_get`    | 读取指定日条目；找不到返回错误                                           |
| `diary_delete` | 删除指定日条目；返回 `{ ok, action, date }`                              |
| `diary_list`   | 列表 / 日期过滤（不变）                                                  |
| `diary_search` | 混合搜索（不变）                                                         |

**与 SAP/UI 的区别**：Shell `/diary` 与人类编辑仍通过 SAP `diary.create` / `diary.patch` 等，以 entity **`id`** 定位；Agent ToolSet 仅面向 LLM，统一用 **`date`**。

## SAP 方法

UI 卫星 `@freeanima/satellite-diary`（`/diary`）通过 SAP 调用：

- `diary.list` / `diary.create` / `diary.append` / `diary.patch` / `diary.delete` / `diary.get` / `diary.search`

所有方法均需 `subject_kind: user | agent`。

## 数据形状

`diary_entry` body：

- `entry_at` — ISO 8601，日记发生时间（**按日唯一**，同一 subject 私有 world 每天至多一条）
- `tags` — 可选标签

标题、摘要、正文使用 entity 列 `title` / `summary` / `content`。
