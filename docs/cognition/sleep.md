---
title: 睡眠机制
---

# 睡眠机制

> 浅睡是增量提取通道（语义 + 感性 + 自传体）；深睡优化语义记忆库存。

## 概述

睡眠是数字生命的记忆整理机制，类比人类的睡眠——大脑在夜间回放白天的经历，将临时记忆转化为长期存储，整理过程本身消散，不留痕迹。

## 设计原则

1. **内部机制，不留痕迹** — 睡眠在后台运行，不写入 session，不影响对话流
2. **不照搬人类的节奏** — 触发基于系统需求（cron），非实时
3. **两级分层** — 浅睡（增量写入）、深睡（语义库存优化）
4. **身份上下文** — 所有记忆处理须携带**自我层五块** + 常驻记忆（见 [`self-layer.md`](self-layer.md)）

## 当前状态

| 机制           | 状态      | 说明                                                                                                                                             |
| -------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| 睡眠周期管线   | ✅ 已实现 | 进程内 `Bun.cron` `builtin-sleep-cycle` @ 02:00 CST（不经 PG `cron_jobs`）                                                                       |
| 会话清理       | ✅ 已实现 | 睡眠周期 DAG 中浅睡前的步骤 `conversation-cleanup`                                                                                               |
| 浅睡（周期内） | ✅ 已实现 | 睡眠周期 DAG 中的步骤 `light-sleep`                                                                                                              |
| 深睡（周期内） | ✅ 已实现 | 步骤 `deep-sleep`（依赖 light-sleep）；**定时仅 CST 周一** full，其余 scheduled 日 skipIf 跳过                                                   |
| 记忆引用同步   | ✅ 已实现 | 步骤 `memory-ref-sync`，依赖 light-sleep                                                                                                         |
| 自我层刷新     | ✅ 已实现 | 步骤 `self-layer-refresh`，在 deep-sleep + memory-ref-sync 之后；CST 周一；提议写入 agent Inbox（不静默写块）                                    |
| 梦境（周期内） | ✅ 已实现 | 步骤 `dream`，依赖 light-sleep；与 deep-sleep 并行                                                                                               |
| 时间摘要       | ✅ 已实现 | 步骤 `temporal-summary-day` / `temporal-summary-cascade`（cascade 依赖 day，不依赖 deep-sleep）；见 [`temporal-summary.md`](temporal-summary.md) |

## 编排

睡眠使用由 `PipelineRunner`（`@freeanima/host/engine/pipeline`）编排的**宏观 DAG**（`sleep-cycle` 管线）。单个 cron 任务触发完整周期；步骤顺序与依赖在代码中显式声明（[`src/host/platform/boot/sleep-cycle.ts`](../../src/host/platform/boot/sleep-cycle.ts)）。

**浅睡**与**深睡**在 `runLightSleep()` / `runDeepSleep()` 内部保留**多阶段/多轮**顺序，不提升为宏观 DAG 节点。

栖息地（`/habitat/dashboard/sleep`）支持**诊断**运行：完整周期或单步（`force` 跳过依赖检查）。手动运行前可选**深睡模式**（full vs incremental）。

**管线步骤历史**持久化在 PG `pipeline_step_run`（每个节点执行一行，含失败与经 `attempt` 的手动重试）。睡眠周期调度是**进程内 `Bun.cron`**（不出现在栖息地 → Cron / `cron_log`）；诊断仍在睡眠仪表盘。多栖息地互斥使用 Redis 锁 `anima:lock:sleep-pipeline`（与手动睡眠 API 共用）。

管线运行状态持久化于 `~/.anima/runtime/pipeline_sleep-cycle_run.json`（步骤状态的 SSOT）。

## 浅睡

| 属性 | 值                                                                                             |
| ---- | ---------------------------------------------------------------------------------------------- |
| 触发 | 睡眠周期步骤 `light-sleep`（cron @ 02:00 或栖息地诊断）                                        |
| 范围 | 上一 CST 日历日有 `updated_at` 的会话（**排除 cron-platform 会话**）                           |
| 输入 | **时间戳落在同一日窗口内的消息**（user+assistant，工具已剥离），按会话分段 —— 不是完整对话历史 |
| 空日 | 若某会话当日有更新但**日窗口内无消息**，则省略提取                                             |
| 编排 | 两阶段顺序执行（各一次独立 LLM 调用）                                                          |

### 阶段

| 阶段   | 目标     | 目的                       |
| ------ | -------- | -------------------------- |
| 1 语义 | 语义记忆 | 从对话提取事实、偏好、经历 |
| 2 感性 | 情绪锚点 | 捕捉会话情绪与情绪转折点   |

自传体叙事提取（原阶段 3 / 3b）已**退役**；历史叙事实体保持只读。见 [`self-layer.md`](self-layer.md)。

**克制原则：** 各阶段 LLM 可判断「无值得记录」→ 不写入；程序仍继续后续阶段。

**去重（语义）：** 仅与同 source conversation 的已有记忆比较；跨脉络合并留给深睡。

**去重（感性）：** 对同批会话已有感性记忆做软克制（按 `conversation_id` 查询）；不对同一会话重复记录相似感受。

## 深睡

| 属性 | 值                                                                                                           |
| ---- | ------------------------------------------------------------------------------------------------------------ |
| 触发 | 睡眠周期步骤 `deep-sleep`（浅睡之后）；**scheduled 仅 CST 周一**；周二–周日定时 skip；手动 / catch_up 仍可跑 |
| 目标 | 全部活跃语义记忆                                                                                             |
| 操作 | 矛盾检测 + 过期标记、拆分、去重合并、置顶质量审查——四轮顺序执行                                              |
| 模式 | **Full**（定时周一 + 手动默认）：四轮全跑；**Incremental**（手动可选）：安静轮可 skip（见下）                |

### 四轮

| 轮次 | 意图                                             |
| ---- | ------------------------------------------------ |
| 1    | 矛盾检测 + 过期标记                              |
| 2    | 拆分多事实条目                                   |
| 3    | 去重合并相似条目                                 |
| 4    | 置顶质量审查（解除过时置顶；常驻读仍上限 40 条） |

**顺序理由：** 先清理问题，再细化，再合并，最后审查置顶质量。

**增量跳过规则：** mode 为 incremental 且过去 24 小时内无活跃记忆 `updated` 时，跳过第 1、3 轮。第 2 轮仅对预筛的拆分候选运行（长文/多句且近期 `updated`）。第 4 轮（置顶维护）始终运行。**定时 cron 仅在 CST 周一跑深睡（full）**；周二–周日定时周期跳过该步。栖息地手动运行默认 full，可选 incremental。

**auto_llm_runs：** 浅睡每个 LLM 阶段一行（`light-sleep/semantic`、`light-sleep/limbic`）；深睡每轮一行（`deep-sleep/<round>`）；自我层刷新一行（`self-layer-refresh`）。多行 ≠ 多次睡眠周期触发。

### 矛盾定义（排他性）

两条记忆在语义上互相否定，且无法用时间变化解释 → 矛盾。

- ✓ 矛盾：「女儿属虎」vs「女儿属羊」
- ✗ 不矛盾：「喜欢苹果」vs「喜欢樱桃」（可共存）
- ✗ 非矛盾（变化）：「喜欢 Python」vs「现在更喜欢 TypeScript」

## 触发机制

```cron
0 2 * * *  sleep-cycle   # in-process Bun.cron: cleanup → light → deep(Mon only) ∥ dream ∥ …
```

DAG（宏观层）：

```text
conversation-cleanup
  └─► light-sleep
        ├─► deep-sleep   # scheduled: CST Monday only (skipIf otherwise)
        ├─► dream
        ├─► temporal-summary-day ──► temporal-summary-cascade
        └─► memory-ref-sync
              └─► self-layer-refresh  # also depends on deep-sleep; CST Monday skipIf
```

### 会话清理（浅睡前）

作为 sleep-cycle 第一步，在浅睡扫描昨日 sessions 之前运行。

| 条件                                | 结果                                 |
| ----------------------------------- | ------------------------------------ |
| 会话未绑定到 satellite app/instance | 拒绝                                 |
| 实例离线                            | 拒绝                                 |
| 工具未在已连接实例上注册            | 拒绝                                 |
| 未注册的 `sap_*` 名称               | 守卫处理器返回错误（不回退到栖息地） |

**过期**指 `conversations.updated_at` 早于 **24 小时**（墙钟 `timestamptz`，非 CST 日界）。近期空 session（如 satellite「新对话」尚无首条消息）保留至次夜运行。

宕机后，下次计划运行会补跑。

**压缩**保持会话级（回合时 `advanceCompressionMeta`）；**不是**睡眠周期步骤。夜间巩固不替代每会话压缩。

## 历史日（栖息地）

对单个过去的 CST 日历日（如上线前或迁移后），使用 **栖息地 → 睡眠**（`/habitat/dashboard/sleep`）：

1. 将 **Day** 设为 `YYYY-MM-DD`
2. 运行 **light-sleep** 步骤（如需跳过依赖检查可勾选 **Force**）

### 补睡眠（一键）

宕机或迁移后，同一页的 **Catch up sleep**：

1. 从最早会话日（否则最早消息日）扫描到**今日**（CST）
2. 对每个有会话活动的日（与浅睡相同过滤）：
   - 缺失成功的 `light-sleep` → 跑 `light-sleep`（`force`，trigger `catch_up`）
   - 缺失全局 `temporal_summary` 日实体 → 跑 `temporal-summary-day`
3. 然后对该范围内的**月初**跑 `temporal-summary-cascade`（重建上月；1 月 1 日亦重建上年）

**不含：** 深睡（全库存；晚跑仍有效）、梦境（需要时用单步 Force）、会话半小时 tick（仅当日）。

每步运行记入睡眠页的 **Pipeline history** 表（`pipeline_step_run.output`；deep-sleep 行含每轮摘要与变更快照）。该日跨会话合并仍依赖后续一次 **deep-sleep**。Cron 触发的周期运行出现在 **栖息地 → Cron → Run history** 的 sleep-cycle 任务上。

## 与现有架构的关系

```text
Conversation archive
  │ sleep-cycle pipeline (02:00)
  │   step light-sleep (semantic + limbic)
  ├─► semantic memory
  └─► emotional anchors
  │
  │   step deep-sleep (four internal rounds)  # Mon
  ▼
semantic memory (consolidated)
  │   step memory-ref-sync
  │   step self-layer-refresh → agent Inbox proposal (Mon; partner confirms before write)
  │ scoped search tools (real-time retrieval in conversation)
  ▼
Agent identity and recalled fragments in current context
```

## `memory_remember` 工具

对话中的 `memory_remember` 是创建语义记忆的便捷封装。可通过 deprecate 软废弃；也支持物理删除。
