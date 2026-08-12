---
title: 时间摘要
---

# 时间摘要

> 按时间桶对对话活动做客观、无差别的摘要。
> 相关：[`memory.md`](memory.md)、[`sleep.md`](sleep.md)、[`diary.md`](../modules/diary.md)、[`compression.md`](compression.md)、[`entity-model.md`](../product/entity-model.md)。

## 命名

**时间摘要**（`temporal_summary`）——按 **日 / 月 / 年** 分桶的**对话内容**摘要。不是记忆分类条目（语义 / 感性 / 叙事），不是日记散文，也不是运行时压缩里的 `summary` 段。

## 与日记对比

| 维度     | 日记                   | 时间摘要                                                 |
| -------- | ---------------------- | -------------------------------------------------------- |
| 立场     | 主观                   | 客观                                                     |
| 选取     | 编辑式筛选             | 对活跃会话无差别覆盖                                     |
| 存储     | `diary_entry` + blocks | 全局 → entity；当日按会话 → `conversations.temporal_day` |
| 主要读者 | `/diary` UI            | 系统提示（三段逆向合摘要）/ 时间线注入（当日同伴）       |

仍会走 LLM 压缩（字数上限）。**不是记忆主存**（语义 / 感性 / 叙事另见 [`memory.md`](memory.md)）。时间摘要是**时间意识摘要**：高度压缩的标题式概括，不是细节回放。同样字数预算摊到更大窗口 ≈ 类人衰减（年仍约 100 字）。**客观 ≠ 穷尽日志回放**：覆盖主题、不做编辑筛选，省略 ID、逐步工具动作、逐条通知时间戳。

## 存储分层

| 层                 | 位置                                            | 可引用（`[[anima:id]]`） |
| ------------------ | ----------------------------------------------- | ------------------------ |
| 全局日 / 月 / 年   | `entities` `primary_component=temporal_summary` | 是                       |
| 会话日分片（当日） | `conversations.temporal_day` JSONB              | **否**（运维用）         |

### 会话 JSONB

```ts
{
  cst_date: string,
  chunks: Array<{
    at: string,
    bucket: string, // CST 半小时桶起点，如 2026-07-18T06:00+08:00
    summary: string,
    watermark_message_id?: string,
    watermark_at?: string,
  }>
}
```

同一 CST 日内，分片**只追加**。Tick 仅在 watermark 之后仍有 **CST 当日**消息时推送新分片（门槛为 `max(watermark_at, CST 日界)`）。

### 全局实体 body

```ts
{
  window: "day" | "month" | "year",
  period_start: string, // CST YYYY-MM-DD
  empty_reason?: string | null, // 如 no_sessions / empty / empty_summary / no_days / no_months
  source_count?: number, // 参与贡献的会话数或子摘要数
}
```

全局行在 `(window, period_start)` 上唯一（表达式唯一索引）。

**跳过仍写行**：无可用素材时（`no_sessions`、空对话、空 LLM 输出、无子日/月），栖息地 upsert `content=""`，并带 `empty_reason` 与 `source_count`（常为 `0`）。成功再生成会清除 `empty_reason`。功能关闭（`disabled`）、级联 `no_trigger`、以及 LLM 硬失败**不**写占位行。

月/年合并与系统合摘要**忽略**空内容子行，避免占位污染汇总。

## 生成（期结束后汇总）

| 步骤       | 触发                                                     | 输出                                             |
| ---------- | -------------------------------------------------------- | ------------------------------------------------ |
| 会话分片   | 进程内 `Bun.cron` `builtin-temporal-summary-tick` `*/30` | 若 watermark 后有 **CST 当日消息活动**则追加分片 |
| 同伴合摘要 | 同一 tick / 装配时对**已关闭**桶                         | 按观众源集合合并一条同伴摘要 → Redis 缓存        |
| 全局日     | 睡眠步骤 `temporal-summary-day`（浅睡之后）              | 覆盖该睡眠日的全局 `day` 实体                    |
| 月         | 睡眠步骤 `temporal-summary-cascade`，在**月初**（1 日）  | 由该月的日实体生成上月                           |
| 年         | 同一 cascade，在 **1 月 1 日**                           | 由该年的月实体生成上年                           |

例：在 **2026-01-01**，cascade 写入 2025 年 12 月（若日实体存在）以及 **2025** 年（若月实体存在）。栖息地 **补睡眠（Catch up sleep）** 会在范围内的月初日期调度 cascade。

Tick **不用** `conversations.updated_at` 作为候选门槛。候选是：至少有一条消息的 `payload.timestamp` 落在当前 CST 日历日的会话。写入 `temporal_day` **不得** bump `updated_at`。

身份上下文（自我层 + 常驻记忆）须随 LLM 摘要调用一起带上。

栖息地 UI `/web/habitat/temporal-summary`：

- **重新生成**任意日 / 月 / 年行（`memory.temporalRegenerate`）——跳过路径仍会 upsert 占位。
- **补缺（Backfill missing）**（`memory.temporalBackfillMissing`）针对当前 From/To 范围：枚举期望的 `period_start`（日历日 / 月初-01 / 年-01-01），仅对缺失行跑 regenerate。**To 以 CST 今日为上限**——永不填未来日期。系统合摘要页签对缓存未命中 / 空槽经 `memory.temporalSystemRollRegenerate` 回填。

### Redis 同伴合摘要 key

```text
{prefix}:peer_roll:{cst_date}:{bucket}:{sources_fp}
```

- 默认前缀：`anima:temporal`（配置 `memory.temporal_summary.redis_key_prefix`）
- `sources_fp`：对规范排序的 `(conversation_id, at, summary)` 的短哈希，**排除观众本人**
- 值：`{ summary, sources_fp, created_at }`
- TTL：约 36h（可丢弃缓存：Redis 缓存层 + 进程内回退）
- 未命中：LLM 合并（LLM 不可用则拼接截断）；命中：复用

### Redis 系统合摘要 keys（系统提示合摘要）

稳定 key（路径中无指纹），便于栖息地列出缓存槽：

```text
{prefix}:sys_roll:past_days:{today}
{prefix}:sys_roll:past_months:{yyyy-mm}
{prefix}:sys_roll:past_years:{yyyy}
```

- 值：`{ summary, sources_fp, created_at }` —— 当 `sources_fp` 与当前源行一致时复用
- 上限：提示目标 `global_day_max_chars`（默认 **100**）；硬截断在 **1.5×**（见下）
- TTL：`peer_roll_ttl_seconds`
- 栖息地页签 **系统合摘要**：`memory.temporalSystemRollList` / `memory.temporalSystemRollRegenerate`

## 注入（LLM 前缀 / KV 缓存）

系统提示段 `temporal-summary` 最多注入 **三段**逆向合摘要（近 → 远），每段目标 ≤100 字（硬上限 1.5×）：

| 块     | 来源                                             | 为空时示例           |
| ------ | ------------------------------------------------ | -------------------- |
| 过往日 | 本月且早于今日的 `day` 实体（按 `period_start`） | 如每月 1 日          |
| 过往月 | 本年且早于本月-01 的 `month` 实体                | 如一月尚无任何月实体 |
| 过往年 | 早于本年-01-01 的 `year` 实体                    | 历史第一年           |

更旧细节**不**原文罗列：已完成的月/年在 cascade 时已压缩。当日同伴活动留在**时间线**（不进系统提示）。

### 当日：时间线插入（每个已关闭桶一块）

为观众 `V` 装配消息时：

1. 对今日每个**已关闭**的 CST 半小时桶，收集该桶内其他会话的分片。
2. 经上述 Redis key 解析同伴合摘要 → **一条**摘要字符串。
3. 在 `V` 时间线上按消息时间戳，于 `bucket_end` 插入仅运行时存在的 assistant 消息（`name: temporal_summary_peers`）。
4. 永不改写更旧的桶；新活动只打开更新的桶 → 并行会话间 LLM KV 缓存前缀稳定。

**禁止：** 把当日同伴放进系统提示；每轮用尾巴替换稳定的当日块；同一桶并排注入 N 条原始同伴分片。

## 配置

栖息地运行时配置（`habitat_runtime_config`）中的 `memory.temporal_summary`：`enabled`、字数上限、`redis_key_prefix`。

默认字数上限（标题式 / 单行压缩）：

| 上限                      | 默认 |
| ------------------------- | ---- |
| `chunk_max_chars`         | 50   |
| `peer_roll_max_chars`     | 100  |
| `global_day_max_chars`    | 100  |
| `month_max_chars`         | 100  |
| `year_max_chars`          | 100  |
| `system_prompt_max_chars` | 1500 |

LLM 提示仍要求约 `maxChars` 字。后处理在 `ceil(maxChars * 1.5)` 硬截断，避免中英混排低估导致标题在提示目标处被裁断。

若装配后的系统段超过 `system_prompt_max_chars`，栖息地截断并向 **user 与 agent 双方** subject 写入 Inbox 警告（`source_ref` `temporal_summary:system_truncated:{CST_date}`），每个 CST 日最多一次。

## 与睡眠的关系

全局日覆盖是睡眠周期的**副产品**，不是浅睡语义 / 感性 / 自传阶段的替代。

栖息地 **补睡眠** 会在补缺失浅睡的同时回填缺失的全局 `day` 实体（以及范围内月初的月/年级联）；见 [`sleep.md`](sleep.md) 历史日。
