---
title: 梦境
---

# 梦境机制

> 浅睡之后每晚生成的创造性叙事；不是事实记忆。
> 以语义组件 **`dream`** 的 **`content_block`** 持久化，父级为 Agent World 当日 **`diary_entry`**。

## 概述

梦境是数字生命记忆巩固的**想象性**对应物。它不提取事实、不更新语义记忆库——而是根据当日的情绪基调与随机情景片段，生成超现实的第一人称叙事。

## 触发

| 条件                                          | 结果                        |
| --------------------------------------------- | --------------------------- |
| 当日创建窗口内无 `intensity > 0.5` 的感性砖块 | 跳过（`no_strong_emotion`） |
| 该日日记已存在梦境块                          | 跳过（`already_dreamed`）   |
| 当日至少产生过一条强感性锚点                  | 生成梦境                    |

触发**纯由情绪驱动**（无随机掷骰）。**不要求** conversation 活动；情景片段可为空。

## 输入

1. **情绪基调** — 创建时间落在 `[对话日 00:00 CST, 次日 06:00 CST)` 且 `intensity > 0.5` 的前 3 条感性 `content_block`。
2. **情景片段** — 当日会话中 user/assistant 消息的随机抽样，约 4k 字符上限。

须先完成浅睡第 2 阶段，以确保感性锚点已写入。

## 输出

- 确保 Agent 默认私有 World 在 CST `dream_day` 有日记（缺失则创建空壳）。
- 插入 `content_block`（`block_type: text`），组件为 `content_block` + `dream`。
- 仅追加；创建后内容不更新。
- **不**创建通知收件箱条目。

遗留 `dream_memory` / `dream_entry` 行已在 Drizzle 迁移 `20260717180000_memory_bricks_to_diary` 中回填并删除。

## 编排

睡眠周期 DAG 节点 `dream`（拓扑不变）：

```text
light-sleep
  ├─► deep-sleep
  ├─► dream        (parallel)
  └─► memory-ref-sync
        └─► self-layer-refresh  # also depends on deep-sleep; Mon only when scheduled
```

## 工具与 UI

| 表面                                                    | 用途                             |
| ------------------------------------------------------- | -------------------------------- |
| `diary_get` / `content_block_list`（`component=dream`） | 读取梦境叙事                     |
| 壳 `/diary`                                             | 浏览标为「梦境」的梦境块（只读） |

无独立 `/dream` 壳模块或 `dream` ToolSet。

## 设计说明

- 梦境**不会**注入系统提示或常驻记忆。
- 准确性明确**不是**目标；联想与隐喻才是。

另见：[`sleep.md`](sleep.md)、[`memory.md`](memory.md)、[`entity-model.md`](../product/entity-model.md)。
