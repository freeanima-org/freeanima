---
title: Sleep
---

# 睡眠机制 (Sleep)

> 浅睡（Light Sleep）为增量提取通道（语义 + 感性 + 自传体）；深睡（Deep Sleep）为记忆库存量优化。

## 概述

睡眠是数字生命的记忆整理机制，类比人类的睡眠——大脑在夜间回放白天的经历，将临时记忆转化为长期存储，整理过程本身消散，不留痕迹。

## 设计原则

1. **内部机制，不留痕迹** — 睡眠在后台运行，不写入 session，不影响对话流
2. **不照搬人类的节奏** — 触发基于系统需求（cron），非实时
3. **两级分层** — 浅睡（增量写入：语义 / 感性 / 自传体）、深睡（语义存量优化）各司其职
4. **身份上下文** — 所有记忆处理必须携带**自我层六块** + 常驻记忆（见 [`self-layer.md`](self-layer.md)）

## 当前状态

| 机制      | 状态      | 说明                              |
| --------- | --------- | --------------------------------- |
| 浅睡 cron | ✅ 已实现 | 每天 02:00，`builtin-light-sleep` |
| 深睡 cron | ✅ 已实现 | 每天 03:00，`builtin-deep-sleep`  |

## 浅睡 (Light Sleep)

| 属性     | 值                                                                          |
| -------- | --------------------------------------------------------------------------- |
| 触发     | 仅 cron，每天 02:00（`0 2 * * *`），不支持手动触发                          |
| 处理范围 | CST 前一个自然日内有活动的 session（`sessions.updated_at`）                 |
| 输入     | 当日全部对话（user+assistant，去 tool），按 session 分段                    |
| 编排     | 三阶段顺序执行（同级、各自独立 LLM 调用；前一阶段零工具调用不跳过后续阶段） |

### 三阶段

| 阶段   | 目标存储                            | 工具白名单                                        | 输入要点                                                   |
| ------ | ----------------------------------- | ------------------------------------------------- | ---------------------------------------------------------- |
| 1 语义 | `semantic_memory`                   | `memory_semantic_create` / `update` / `deprecate` | 对话 + 已有 semantic（`listBySourceSessions`）             |
| 2 感性 | `limbic_memory`                     | `memory_limbic_create`                            | 对话 + 已有 limbic（`listBySession`）                      |
| 3 自传 | `autobiographical_memory`           | `memory_autobiographical_create` / `deprecate`    | 对话 + 当日 semantic + 当日 limbic + 已有 autobiographical |
| 3b     | `self_blocks.autobiography_summary` | （程序压缩，无 LLM）                              | active 自传叙事 → 概括块刷新                               |

**克制原则**：各阶段 LLM 判断「无值得记录」→ 不调用工具、直接回复跳过；程序不因前一阶段零工具调用而跳过后续阶段。

**去重（语义）**：**局部**——仅与同 `source_sessions` 的已有记忆比较；跨脉络留给深睡。

实现：[`life/memory/src/light-sleep/run.ts`](../life/memory/src/light-sleep/run.ts)；装配：[`serve.ts`](../service/service/src/serve.ts)。

### Stage 1 消息结构

System prompt：自我层六块 + 常驻记忆（pinned facts，top 20）。

| #   | 内容                                                                         |
| --- | ---------------------------------------------------------------------------- |
| 1   | 当日全部对话：user+assistant，按 session ID 分段，带时间戳与上下文标注       |
| 2   | 已有记忆：`listBySourceSessions` 预筛（与当日 session 有交集的 active 记忆） |
| 3   | 语义提取指令 + 三工具用法说明                                                |

LLM **不**携带 `memory_semantic_search`（消息 2 已由程序提供）。

### memory_semantic_update 语义（覆盖式）

- **仅修改传入的字段**，未传字段保持不变
- 要清空 `source_sessions` → 显式传 `source_sessions: []`
- 未传 `source_sessions` → 保持原值

### 流程

```
1. 计算 CST 前一日时间窗
2. listSessionIdsUpdatedBetween → 涉及 session 列表
3. Stage 1：语义提取 → semantic_memory
4. Stage 2：感性提取 → limbic_memory
5. Stage 3：自传叙事提取 → autobiographical_memory
6. Stage 3b：压缩刷新 → self_blocks.autobiography_summary
7. 写入 light_sleep_state.json
```

### 上下文过大

单次输入超过约 120k 字符时，按 session 更新时间倒序截断，并在对话段末尾标注 `[已截断 N 个 session]`（各阶段复用同一截断逻辑）。

## 深睡 (Deep Sleep)

| 属性     | 值                                                                                                          |
| -------- | ----------------------------------------------------------------------------------------------------------- |
| 触发     | 仅 cron，每天 03:00（`0 3 * * *`），不支持手动触发                                                          |
| 处理对象 | `semantic_memory` 全量 active 记忆                                                                          |
| 操作     | 矛盾检测 + 过期标记、拆分、去重合并，三轮顺序执行                                                           |
| 工具     | `memory_semantic_create` / `memory_semantic_update` / `memory_semantic_deprecate` / `memory_semantic_merge` |

### 三轮处理

| 轮次 | 意图                | 关注点                                           |
| ---- | ------------------- | ------------------------------------------------ |
| 1    | 矛盾检测 + 过期标记 | 排他性矛盾 → deprecate；被新事实取代 → deprecate |
| 2    | 拆分                | 一条 content 含多个独立事实 → 拆为多条           |
| 3    | 去重合并            | 重复/高度相似 → 合并为一条                       |

**顺序理由**：先清理问题（矛盾+过期），再细化（拆分），最后合并。每轮看到的是前序轮处理后的干净数据。

### 矛盾定义（排他性）

两条记忆在语义上互相否定，且无法用时间变化解释 → 矛盾。

- ✓ 矛盾：「女儿属虎」vs「女儿属羊」（生肖唯一）
- ✓ 矛盾：「不喜欢吃辣」vs「喜欢吃辣」（直接否定）
- ✗ 不矛盾：「喜欢苹果」vs「喜欢樱桃」（可共存）
- ✗ 不矛盾（变化）：「喜欢 Python」vs「现在更喜欢 TypeScript」（新旧都可对）

### 消息结构

System prompt：自我层六块 + 常驻记忆。

| #   | 内容                      | 说明                                                      |
| --- | ------------------------- | --------------------------------------------------------- |
| 1   | 全量 active 语义记忆 JSON | **每轮完全相同 → provider 缓存**                          |
| 1.5 | 增量变更摘要              | 首轮为空；后续每轮追加前序操作（已合并/已废弃/新增/修改） |
| 2   | 程序预筛                  | 首版为空                                                  |
| 3   | 指令                      | 本轮意图 + 工具用法说明                                   |

消息1 是 token 消耗大头且线性增长，保持不变以最大化 provider 缓存。

### 消息1.5 格式

```
# 增量变更（以本内容为准）

## 已处理（请忽略消息1中的以下原始条目）
f-001 — 已被合并到 f-003
f-010 — 已过期/废弃（新事实取代）

## 新增条目（未在消息1中出现）
f-003 (world) "张三在上海浦东工作" sources=[s-abc,s-def] observed=2026-05-01T...

## 已修改条目（以本内容为准，覆盖消息1中的原始版本）
f-030 — 已修改：content 更新为 "..."
```

### 阈值策略

| 全量 JSON 大小 | 行为                  |
| -------------- | --------------------- |
| < 10k          | 正常                  |
| 10k ~ 100k     | ⚠️ warn log，正常处理 |
| 100k ~ 300k    | 按 type 分批处理      |
| > 300k         | ❌ 报错拒绝           |

### merge_semantic_memories 工具

程序自动处理字段缝合，LLM 只需关心合并后的新 content：

- `source_sessions` → 所有源记忆的并集去重
- `observed_at` → 取最早值
- 创建新记忆 → 废弃所有 source_ids
- 仅 1 个 source_id → 提示使用 update_semantic_memory

### 操作日志

每轮操作记录写入 `~/.anima/logs/deep_sleep_{day}_{round_index}_{round}.json`，不进数据库，仅用于排查。

记录内容：当日日期、轮次、active 记忆数、前序变更数、tool_calls 数、summary、变更日志快照。

## 触发机制

```cron
0 2 * * *  light-sleep           # builtin-light-sleep（语义 + 感性 + 自传体）
0 3 * * *  deep-sleep            # builtin-deep-sleep
30 5 * * *  memory-reference-sync  # builtin-memory-reference-sync
```

宕机后下次对应时刻补跑即可；非实时系统。

## 历史补跑（一次性 CLI）

对上线前或迁移后的历史对话，可按 **CST 自然日**逐日补跑浅睡，与 nightly cron 逻辑一致，但由人工触发、独立进度文件。

```bash
anima memory sleep backfill [--from YYYY-MM-DD] [--to YYYY-MM-DD] [--resume]
```

| 选项       | 说明                                                          |
| ---------- | ------------------------------------------------------------- |
| `--from`   | 起始日；省略时取 `sessions` 中最早非 debug 会话的 CST 日      |
| `--to`     | 截止日；省略时为 **昨日 CST**（与 02:00 cron 默认处理日一致） |
| `--resume` | 从进度文件续跑，跳过已完成日                                  |

**进度文件**：`~/.anima/runtime/light_sleep_backfill_state.json`（与 `light_sleep_state.json` 独立）。

**行为要点**：

- 每日独立调用 `runLightSleep({ day })`；单日失败记录后继续下一天
- Stage 3b（自传概括刷新）默认仅在 **最后一天** 执行，中间日跳过以节省 token
- 补跑前请确保 LLM 能正确填写 `observed_at` / `occurred_at`（见 [`memory.md`](memory.md)）；否则记忆时间会落成补跑时刻
- 补跑只写入 semantic / limbic / autobiographical；**跨 session 语义合并仍靠深睡**——补跑结束后建议手动等一次 03:00 深睡或自行触发
- 与 02:00 cron 无冲突，但建议补跑时暂停服务或错开凌晨窗口
- 单次对话输入仍受约 **120k 字符**限制（见上文「上下文过大」）

实现：[`life/memory/src/light-sleep/backfill.ts`](../life/memory/src/light-sleep/backfill.ts)；CLI bootstrap：[`bootstrap-memory-jobs.ts`](../service/service/src/bootstrap-memory-jobs.ts)。

## 与现有架构的关系

```
PG messages（对话存档）
  │ 浅睡 cron（02:00，三阶段）
  ├─► semantic_memory
  ├─► limbic_memory
  └─► autobiographical_memory ──压缩──► self_blocks.autobiography_summary
  │
  │ 深睡 cron（03:00，语义维护）
  ▼
semantic_memory（整理后）
  │ memory_recall（对话中实时检索）
  ▼
当前上下文中的 Agent 身份与召回片段
```

`session:updated` EventBus 事件仍保留（WebUI 刷新等），**不再**触发 reflect。

## memory_remember 工具

对话中的 `memory_remember` 为便捷封装：自动推断 `source_sessions`（当前 session）与 `observed_at`，底层调用 `memory_semantic_create` 逻辑。物理删除仍走 `action=delete`；软废弃用 `memory_semantic_deprecate`。
