---
title: 回忆流程
---

# 分范围记忆检索

> **当前：** 主动检索按**范围拆分**。没有跨类型统一的 `memory_recall` 工具，也没有面向 LLM 的跨类型 RRF 合并。
> **程序侧：** `MemoryService.recall({ scope: "semantic"|"temporal" })` 为统一门面（委托 SearchBackend）；与 LLM 工具名分离。目标 SSOT：[`memory.md`](memory.md)。

## 按范围的主动工具

| 范围               | 工具                                                    | 说明                                                         |
| ------------------ | ------------------------------------------------------- | ------------------------------------------------------------ |
| semantic           | `memory_semantic_search`                                | FTS + 结构化过滤；每轮 user 前也**被动**注入                 |
| limbic / narrative | `content_block_search`（`component=limbic\|narrative`） | 情绪砖 / 自传砖；可选用 `content_block_get` / `diary_search` |
| conversation       | `conversation_search` / `conversation_scroll`           | 对话片段；搜索可按会话过滤；scroll 取完整上下文              |
| write（semantic）  | `memory_remember` / semantic CRUD                       | 非检索                                                       |

### 产品回忆策略（系统提示）

对**澄清指代 / 回忆事实**，对话系统提示段 `memory-recall` 指示模型优先**仅语义记忆**，顺序为：

1. 常驻记忆（系统提示）
2. 本轮被动注入（`passive_memory_context`）
3. 仍不足时主动 `memory_semantic_search`

情绪 / 自传用 `content_block_search`（`component=limbic|narrative`）；对话搜索仍可用于明确的非语义需求；它们**不是**默认澄清/回忆路径。

栖息地运维调试用 `memory.passiveRecallDebug`（被动管线追踪）。产品 LLM 路径用上表分范围工具。

### 常驻记忆

与检索工具分开：**置顶**语义记忆加上**引用最多**的条目始终注入系统提示。LLM 在回复中引用记忆 ID 标记；引用计数在 `syncTurn` 热路径 bump（`memory-ref-sync` 夜间步已删）。

## 与自我层的关系

自我层（五块）**不**经记忆搜索工具检索——它始终在系统提示中。

| 层     | 注入                  | 原因                               |
| ------ | --------------------- | ---------------------------------- |
| 自我层 | 始终在系统提示        | 小、固定，每次对话都需要「我是谁」 |
| 记忆层 | 分范围工具 / 被动语义 | 大、动态，需要时再搜               |

## 已退役：统一回忆

`memory_recall`（四源 RRF）已**移除**。会话/对话搜索仅留在 `conversation_search`。跨资源「统一回忆 v2」（[Issue #47](https://github.com/freeanima-org/freeanima/issues/47)）仍未规划。

旧对话工具 `memory_limbic_*` / `memory_autobiographical_*`（读+写）已移除；情绪/自传砖统一走 `content_block_*` / `diary_*`。

## 命名说明

在认知心理学中，**Recall（回忆）**是主动从记忆中提取已存信息。FreeAnima 文档保留该动词；运行时工具按**范围**命名，使模型在无跨类型排序冲突下路由意图。
