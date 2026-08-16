---
title: 压缩
---

# 上下文压缩

> 运行时上下文压缩：对话在数据库中**全量保留**；仅裁切发给 LLM 的**四段视图**。
> 关联：[`context-management.md`](context-management.md)、[`sleep.md`](sleep.md)、[`memory.md`](memory.md)。

## 设计原则

| 原则       | 说明                                                               |
| ---------- | ------------------------------------------------------------------ |
| 不删消息   | 历史保留；压缩只改运行时视图与 `conversations` meta                |
| 四段       | LLM 上下文 = system + summary + slim + raw                         |
| 按需触发   | 用量接近窗口上限时压缩；处于工具调用环（`isInToolLoop`）时阈值更高 |
| 与记忆独立 | 压缩不触发语义提取；retain/memory-maintenance 另走                 |

## 运行时四段

```text
① system  — system prompt (self layer + resident memory + project context)
② summary — text summary of compressed portion (synthetic; not stored in messages)
③ slim    — middle segment: trimmed user/assistant messages
④ raw     — recent segment: full messages including tool calls
```

非压缩路径：新消息仅追加到 raw；边界不变。

压缩路径：用量超阈值时，较旧消息进入 summary/slim；摘要文本异步更新。摘要 LLM 调用为一次性补全（`tool_choice: none`，经 `params.extra` 的 `thinking: disabled`）。

## 配置

在栖息地运行时调整（`habitat_runtime_config`；壳 **设置 → 栖息地服务 → 服务配置**）：

```yaml
# habitat_runtime_config fragment (not config.yaml)
compression:
  enabled: true
  reserved_tokens: 8192
  trigger_low: 0.60 # outside tool-calling loop: compress at 60% usage
  trigger_high: 0.80 # inside tool-calling loop (`isInToolLoop`): compress at 80% usage
  emergency_ratio: 0.92
  raw_min_messages: 5
  slim_min_messages: 50
  summary_max_tokens: 4000
  max_message_pairs: 50 # 消息对数回退阈值（≠ 引擎轮 / 工具轮次）
```

| 设置                | 默认值 | 说明                                     |
| ------------------- | ------ | ---------------------------------------- |
| `trigger_low`       | 0.60   | 普通对话中的阈值                         |
| `trigger_high`      | 0.80   | 处于工具调用环内的阈值（≠ 单次工具轮次） |
| `max_message_pairs` | 50     | 无上下文窗口时的消息数回退阈值           |
| `raw_min_messages`  | 5      | raw 段最少消息数                         |
| `slim_min_messages` | 50     | 裁剪后 slim 段最少消息数                 |

### Token 计数

压缩与嵌入批打包使用**启发式 token 估算**（进程内 `tokenx`，id `__estimate__:tokenx`），不是完整 HuggingFace 词表。计数为近似（足以做预算触发与分块）；非提供商账单精确值。

### 上下文窗口解析（token 模式）

估算压缩预算时：

1. Provider `/models` 目录的 `contextWindow`（栖息地已注册查找时；可能含 [models.dev](https://models.dev) enrichment — 见 [`service.md`](../ops/service.md) LLM 节）；目录 miss 时常见默认 128k
2. 以上皆无时的消息数回退（`max_message_pairs` 阈值；≠ `max_loop_iterations` 引擎轮）

目录只读，不经运行时配置覆盖。无上下文窗口来源时，压缩回退到按消息数触发。

在对话中强制压缩：`/compress`（`--force` 忽略迟滞）。

手动摘要（Cursor 风格）：`/summarize` 将历史折叠进运行时摘要，不等自动阈值。当**回合空闲**（最后一条是已完成的助手回复）时，边界变为 `l2 = l3 = l4`，slim/raw 为空。**进行中**回合时，仅摘要到最后一条已完成助手；未完成尾部留在 raw。摘要文本**增量**合并（与自动压缩相同），命令等待摘要 LLM 完成。若 LLM 运行在 auto-llm 日志中成功但 flush 后 `conversations.compression.summary` 仍空，`/summarize` 返回失败（`summary_empty`）并带 auto-llm `runId` — **不**以空预览报成功。省略摘要文本的并发边界补丁不得抹掉已有非空摘要。

### 回合中保护 vs 空 raw

自动边界推导保持非空 raw 段（带前导 user 消息），以便用量压缩时运行中的**回合**可继续。该规则适用于**必须保留某段 raw 尾**时。它不是禁止空 raw：用户在空闲对话上显式 `/summarize` 时，允许完全折叠（`l2 = l3 = l4`）。回合中保护通过**不把未完成回合折进摘要**实现，而非永久要求 raw 中有 user。

## 与记忆管道的关系

压缩与 retain/reflect **独立运行**：压缩管理当前 conversation 的 LLM 窗口；语义抽取走热路径 `syncTurn` → retain。夜间 **memory-maintenance** 仅做 Retain **缺口检查**（Inbox 通知），补跑仅手动——见 [`sleep.md`](sleep.md)。
