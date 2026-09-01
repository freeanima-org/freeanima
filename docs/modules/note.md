---
title: 笔记本
---

# 笔记本

面向用户与 Agent 的主题向笔记，基于[统一实体模型](../product/entity-model.md)的 `note` **容器**，外加子级 `content_block`（文本）砖块。

## 与日记对比

| 能力     | 笔记本                     | 日记                             |
| -------- | -------------------------- | -------------------------------- |
| 组织     | 标题 / 标签 / 搜索（主题） | `body.entry_at` 按日（每日唯一） |
| 主组件   | `note`                     | `diary_entry`                    |
| 正文     | 子 `content_block`（text） | 同左                             |
| 模板     | 无专用块模板               | `diary_block_template`           |
| 语义砖块 | 不挂梦境 / 感性 / 叙事管线 | 可挂 limbic / narrative / dream  |

同一实体可 **attach** 同时挂 `note` 与 `diary_entry`；壳列表按 **`primary_component`** 决定出现在笔记本还是日记。

## 用户 / Agent 隔离

- 笔记落在 subject **默认私有 World**（与日记相同解析路径）。
- 壳顶栏 **User / Agent** 切换作用域。
- LLM ToolSet `note` 默认调用方私有 World；可选 `world_id`。

## 数据形态

**容器**（`note`）：

- `entities.client_op_id` — 可选幂等键（顶层列；仅 create）
- `tag_ids` — 可选标签（顶层 `entities.tag_ids`）
- `title` / `summary` — entity 列（主题组织主靠 title）
- 容器 **`content` 不用于正文**

**块**（`content_block`，`block_type: text`）：

- `body.parent_id` → 笔记 id
- `body.sort_order` — 视图顺序
- 文本在块的 `content` 列（Markdown 源码）
- 跨笔记引用：正文内 `[[anima:id]]` / `anima:{id}`（见 [`anima-uri.md`](../product/anima-uri.md)）

## Agent 工具（ToolSet `note`）

经 `toolset_load` 加载 `note`。工具按实体 **`id`** 定位；接受可选 **`world_id`**。

| 工具          | 说明                                  |
| ------------- | ------------------------------------- |
| `note_create` | 新建笔记；可选首条文本块与标签        |
| `note_update` | 更新元数据（title/summary/`tag_ids`） |
| `note_get`    | 读取笔记 + blocks                     |
| `note_delete` | 软删笔记（级联子块）                  |
| `note_list`   | 列表（默认 `updated_at` 倒序）        |
| `note_search` | 对文本块混合搜索，返回匹配笔记        |

细粒度块 CRUD / 重排：ToolSet `content-block`（`parent_id` 可为 note）。

## SAP 方法

壳 `/note` 调用：

- `note.list` / `note.create` / `note.append` / `note.patch` / `note.delete` / `note.get` / `note.search`
- `note.blockCreate` / `note.blockPatch` / `note.blockDelete` / `note.blockReorder`

## UI

- 列表：搜索 + 标签过滤 + 新建
- 详情：标题、标签、多文本块；块为 Markdown 源码编辑 + 预览（`renderMarkdownHtml`）；标题与正文均自动保存（防抖）

## 离线

与日记同级 **CRUD outbox**：读走 `withOfflineCache`（`note.list` 空 blocks 不覆盖本地已缓存块）；写走 `preferOnlineWrite`（create / patch / delete / blockCreate / blockPatch / blockDelete）。弱网连续传输失败后壳层进入 **localPrefer**，立刻用本地快照与写队列，不再空等 RPC 超时。详见 [离线平台](../aspects/offline-platform.md)。
