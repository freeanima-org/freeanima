---
title: 时间摘要
---

# 时间摘要

> 按时间桶对对话活动做客观、无差别的摘要。
> **#16102：** Temporal **升格为记忆**（自传体时间骨架），进 MemoryService（`temporal.list/get/…`）；本页描述现行存储与 sleep 副产品行为。
> 相关：[`memory.md`](memory.md)、[`sleep.md`](sleep.md)、[`diary.md`](../modules/diary.md)、[`compression.md`](compression.md)、[`entity-model.md`](../product/entity-model.md)。

## 命名

**时间摘要**（`temporal_summary`）——按 **日 / 月 / 年** 分桶的**对话内容**摘要。目标 taxonomy 中属 **Temporal 记忆**；实现仍多用 `temporal_summary` 组件名。不是日记散文，也不是运行时压缩里的 `summary` 段。

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

| 步骤       | 触发                                                        | 输出                                             |
| ---------- | ----------------------------------------------------------- | ------------------------------------------------ |
| 会话分片   | 进程内 `Bun.cron` `builtin-temporal-summary-tick` `*/30`    | 若 watermark 后有 **CST 当日消息活动**则追加分片 |
| 同伴合摘要 | 同一 tick / 装配 miss 时后台预热对**已关闭**桶              | 按观众源集合合并一条同伴摘要 → Redis 缓存        |
| 全局日     | 维护步骤 `temporal-summary-day`（retain 补跑之后）          | 覆盖该日的全局 `day` 实体                        |
| 月         | 记忆维护步骤 `temporal-summary-cascade`，在**月初**（1 日） | 由该月的日实体生成上月                           |
| 年         | 同一 cascade，在 **1 月 1 日**                              | 由该年的月实体生成上年                           |

例：在 **2026-01-01**，cascade 写入 2025 年 12 月（若日实体存在）以及 **2025** 年（若月实体存在）。栖息地 **记忆维护补跑（Catch up）** 会在范围内的月初日期调度 cascade。

Tick **不用** `conversations.updated_at` 作为候选门槛。候选是：至少有一条消息的 `payload.timestamp` 落在当前 CST 日历日的会话。写入 `temporal_day` **不得** bump `updated_at`。

**全局日选源与 tick 一致**：按该 CST 日是否有消息 timestamp 选会话，**不是** `conversations.updated_at`。

### 计入范围

- **计入**：所有 `debug = false` 且 `platform ≠ cron` 的会话——本地 chat、`remote:*`（含 companion / coding）、discord、weixin 等。
- **不计入**：debug 会话、cron 平台会话。
- **素材**：可回忆的 user / assistant 非空正文（排除纯 tool / 空 assistant+tool_calls）。

身份上下文不进 AutoLlm：时间摘要仅用任务规格 + 材料，不注入自我层或常驻记忆。

栖息地 UI `/web/habitat/temporal-summary`：

- **重新生成**任意日 / 月 / 年行（`memory.temporalRegenerate`）——跳过路径仍会 upsert 占位。
- **补缺（Backfill missing）**（`memory.temporalBackfillMissing`）针对当前 From/To 范围：枚举期望的 `period_start`（日历日 / 月初-01 / 年-01-01），**仅对缺失行**跑 regenerate。已有空占位（`empty_reason`）**不会**被补缺重跑。**To 以 CST 今日为上限**——永不填未来日期。
- **强制重跑**（`memory.temporalRebuildRange`）同一 From/To：对区间内**全部**期望周期 regenerate（覆盖已有空/非空行）。系统合摘要页签对缓存未命中 / 空槽经 `memory.temporalSystemRollRegenerate` 回填。

### Redis 同伴合摘要 key

```text
{prefix}:peer_roll:{cst_date}:{bucket}:{sources_fp}
```

- 默认前缀：`anima:temporal`（配置 `memory.temporal_summary.redis_key_prefix`）
- `sources_fp`：对规范排序的 `(conversation_id, at, summary)` 的短哈希，**排除观众本人**
- 值：`{ summary, sources_fp, created_at }`
- TTL：约 36h（可丢弃缓存：Redis 缓存层 + 进程内回退）
- 未命中：拼接截断注入（不写 Redis）并后台 LLM 预热；命中：复用
- **注入路径**（`beforeLlmCall`）：只读上述 Redis；**禁止**懒打 LLM（对齐系统合摘要）

### Redis 系统合摘要 keys（系统提示合摘要）

稳定 key（路径中无指纹），便于栖息地列出缓存槽：

```text
{prefix}:sys_roll:past_days:{today}       # 覆盖：本月且 < 今日 的 day 实体
{prefix}:sys_roll:past_months:{yyyy-mm}   # 覆盖：本年且 < 本月 的 month 实体
{prefix}:sys_roll:past_years:{yyyy}       # 覆盖：< 本年 的 year 实体
```

- 值：`{ summary, sources_fp, created_at }` —— 当 `sources_fp` 与当前源行一致时复用
- 上限：提示目标 `global_day_max_chars`（默认 **100**）；硬截断在 **1.5×**（见下）
- **TTL（按时间粒度，不复用 `peer_roll_ttl_seconds`）**：
  - `past_days` → **1 天**
  - `past_months` → **约 1 月**（31 天）
  - `past_years` → **1 年**（366 天）
- **写入时机**：记忆维护写完全局日实体后后台 regenerate `past_days`；cascade 写完月/年实体后分别 regenerate `past_months` / `past_years`。Habitat UI 手动 `memory.temporalSystemRollRegenerate` / batch 仍可用。
- **系统提示注入**：只读上述 Redis；cache miss 则跳过该块，**不在** `buildSystemPrompt` / 新建对话路径懒打 LLM。
- 栖息地页签 **系统合摘要**：`memory.temporalSystemRollList` / `memory.temporalSystemRollRegenerate`

## 注入（系统提示 / KV 缓存）

系统提示段 `temporal-summary` 最多注入 **三段**逆向合摘要（近 → 远），每段目标 ≤100 字（硬上限 1.5×）；整段外包 `<temporal_summary>`。注入时**只读 Redis sys_roll**；未命中则跳过该块（不在拼装路径打 LLM）。

| 块     | 来源                                             | 为空时示例           |
| ------ | ------------------------------------------------ | -------------------- |
| 过往日 | 本月且早于今日的 `day` 实体（按 `period_start`） | 如每月 1 日          |
| 过往月 | 本年且早于本月-01 的 `month` 实体                | 如一月尚无任何月实体 |
| 过往年 | 早于本年-01-01 的 `year` 实体                    | 历史第一年           |

更旧细节**不**原文罗列：已完成的月/年在 cascade 时已压缩。当日同伴活动留在**时间线**（不进系统提示）。

### 当日：时间线插入（每个已关闭桶一块）

为观众 `V` 装配消息时：

1. 对今日每个**已关闭**的 CST 半小时桶，收集该桶内其他会话的分片。
2. 经上述 Redis key 解析同伴合摘要 → **一条**摘要字符串（miss：拼接截断并后台预热，不懒打 LLM）。
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

## 与记忆维护的关系

全局日覆盖是记忆维护周期的**副产品**，不是 retain 语义抽取的替代。

栖息地 **补跑** 会在补缺失 retain 的同时回填缺失的全局 `day` 实体（以及范围内月初的月/年级联）；见 [`sleep.md`](sleep.md)。
