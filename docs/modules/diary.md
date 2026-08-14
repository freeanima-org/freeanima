---
title: 日记
---

# 日记

面向用户与 Agent 的结构化日记，基于[统一实体模型](../product/entity-model.md)的 `diary_entry` **容器**，外加子级 `content_block`（文本）砖块。

## 与记忆体系对比

| 能力     | 日记                                              | 记忆砖块（感性 / 叙事 / 梦境）                              |
| -------- | ------------------------------------------------- | ----------------------------------------------------------- |
| 来源     | 用户 / Agent **主动书写**                         | 记忆维护管线 / `content_block_*`（语义组件）                |
| 存储     | `entities` + `diary_entry` + 子级 `content_block` | 同一日记容器 + 语义标签（`limbic` / `narrative` / `dream`） |
| 编辑     | 纯文本块可更新                                    | 语义砖块只追加 / 软废弃                                     |
| 命名空间 | subject **默认私有 World**                        | 记忆维护写入砖块在 Agent 私有 World                         |

日记 UI 把语义砖块（梦境 / 情绪 / 自传）标为日条目中的只读分区。

## 用户 / Agent 隔离

- 用户与 Agent 日记分别落在启动时 `ResolvedWorldContext` / `habitat_runtime_config.worlds`（`user_subject_id` / `agent_subject_id`）解析出的 subject **默认私有 World**。
- 壳顶栏 **User / Agent** 切换选择查看哪个 subject 的日记（见 [`entity-model.md`](../product/entity-model.md) 全局 Subject 作用域）。
- LLM 工具（ToolSet `diary`）默认用**调用方 subject 的私有 World**（对话 LLM → agent world）；可选 **`world_id`** 覆盖（如系统提示中的 `user_world_id`）。

## 数据形态

**容器**（`diary_entry`）：

- `body.entry_at` — ISO 8601，日记发生时间（每个 subject 私有 World **每日唯一**）
- `tag_ids` — 可选标签（顶层 `entities.tag_ids`，指向同 World 的 `tag` entity）
- `title` / `summary` — entity 列
- 容器 **`content` 不用于正文**（迁移后保持为空）

**块**（`content_block`，`block_type: text`）：

- `body.parent_id` → 日记条目 id
- `body.sort_order` — 视图顺序（无语义优先级）
- 文本在块的 `content` 列
- 可选 `title`（entity 列）— 用户可编辑的块标题；空表示 UI 无标题权重
- 可选 `tag_ids`（entity 列）— 统一实体标签（与日记容器同一模型）
- 块上的语义组件标签（`dream` / `limbic` / `narrative`）在标题旁渲染为只读标签（梦境 / 情绪 / 自传）；它们**不是**块标题

**日记块模板**（`diary_block_template` entity，subject 私有 World）：

- `entities.title` = **模板名称**（列表/管理显示）
- `entities.content` / `entities.tag_ids` 保持为空 —— **不要**把插入载荷存那里
- `body.preset` = `{ title, content, components, tag_ids }`，插入新文本块时应用
- SAP：`diary.templateList` / `templateCreate` / `templatePatch` / `templateDelete`
- 空 World 惰性播种「今日回顾」「运动」

UI 还在 localStorage 持久化每块展开/折叠（默认展开）。

一次性迁移：栖息地 `runMigrations` 把遗留日记 `content` 移入第一个文本块并清空容器列。

## Agent 工具（ToolSet `diary`）

经 `toolset_load` 加载 `diary`。工具按 **`date`（YYYY-MM-DD）** 定位条目；**默认今日**（CST 正午 `…T12:00:00+08:00`）；**无 `diary_create`** —— 用 `diary_append`（若缺则创建当日空壳，再加**新文本块**）。所有工具接受可选 **`world_id`**。

| 工具           | 说明                                                                                                   |
| -------------- | ------------------------------------------------------------------------------------------------------ |
| `diary_append` | 按日新建文本块；缺则建壳；存储 `tag_ids`（工具可选 `tags` 标题）仅在建壳时写入                         |
| `diary_update` | 按日更新条目**元数据**（title/summary/`tag_ids`；工具可选 `tags` 标题）—— 不是正文                     |
| `diary_get`    | 按日读取条目 + `blocks`；找不到则报错                                                                  |
| `diary_delete` | 按日删除条目（级联子块）；返回 `{ ok, action, date }`                                                  |
| `diary_list`   | 按 `entry_at DESC` 列表（默认 `limit=20`、`offset`）；可选日期 / `tag_ids`（工具可选 `tags` 标题过滤） |
| `diary_search` | 对**文本块**混合搜索，返回匹配的日记条目                                                               |

细粒度块 CRUD / 重排：ToolSet `content-block`。

**vs SAP/UI**：壳 `/diary` 用 SAP `diary.*` / `diary.block*`，按实体 **`id`** 定位；Agent ToolSet 统一用 **`date`**。

## SAP 方法

UI 卫星 `@freeanima/satellite-diary`（`/diary`）调用 SAP：

- `diary.list` / `diary.create` / `diary.append` / `diary.patch` / `diary.delete` / `diary.get` / `diary.search`
- `diary.blockCreate` / `diary.blockPatch` / `diary.blockDelete` / `diary.blockReorder`（仅文本；create/patch 接受可选 `title` / `tag_ids` / `components`）
- `diary.templateList` / `diary.templateCreate` / `diary.templatePatch` / `diary.templateDelete`（日记块模板；`name` ≠ `preset`）

所有方法要求 `subject_kind: user | agent`。

- `diary.list` 默认 **`entry_at DESC`**，`limit=20`，支持 `offset` 分页
- `diary.create` 可选 `content` → 第一个文本块（容器 `content` 保持为空）
- `diary.append` → 新的末尾文本块
- `diary.patch` → 仅容器元数据
- `diary.delete` → 级联删除子块
- `diary.template*` → `diary_block_template` 的 CRUD（模板名 `name` + 插入载荷 `preset`）
