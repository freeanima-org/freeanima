---
title: 上下文管理
---

# 上下文管理

> 调研与 Working 策略 SSOT（风巢 #16042）。产品原则见 [`architecture.md` 上下文工程](../product/architecture.md)；记忆契约见 [`memory.md`](memory.md)；对话窗口裁剪见 [`compression.md`](compression.md)；夜间巩固见 [`sleep.md`](sleep.md)（旧睡眠已废止，现为 **memory-maintenance**）。

## 一、问题与范围

Agent「记得什么」= **此刻上下文窗口里有什么**。外存（Semantic / Temporal / messages）只是把正确 token 送进窗口的机制。

本页回答四问，并对照 MemGPT/Letta、LangChain、LlamaIndex：

1. 如何决定哪些内容放进 context？
2. 如何压缩/摘要历史而不丢关键信息？
3. 是否有遗忘机制？触发条件是什么？
4. FreeAnima（Instant / Working / Long-term + 召回 + 引用）如何映射？

**硬立场**：记忆编排内建于运行时；**LLM 不控制** retain / reflect / memory-maintenance。

---

## 二、FreeAnima 现行 Working

```text
① systemPromptBuild → fold（分段 budgetChars + 全局 system_prompt_budget_chars）
② buildRuntimeMessages → compress（system | summary | slim | raw）
③ beforeLlmCall → passive_memory_context（可选）
④ 发给 Provider
⑤ 回合后 syncTurn：cite + 异步 retain
⑥ 夜间 memory-maintenance（顺序）：cleanup → Retain 缺口检查（仅通知）→ 周一 reflect/self → temporal
```

| 桶                   | 来源                                | 备注                                      |
| -------------------- | ----------------------------------- | ----------------------------------------- |
| system               | Self、常驻、temporal 段、工具目录等 | fold 截断；核心段硬保留                   |
| summary / slim / raw | 当前会话消息视图                    | 压缩不删 PG；不触发 retain                |
| 被动召回             | `memory.passive_recall`             | 默认 max_chars=2000；排除常驻与本会话来源 |
| 长期                 | Semantic + Temporal                 | 经常驻 / 被动 / `memory_semantic_search`  |

召回优先级：**常驻 → 被动召回 → 主动语义搜索**。

Retain 缺口：夜间只 Inbox 通知；**补跑仅手动**（`memoryMaintenance.*`）。

---

## 三、业界对照

| 框架             | 进 context                                                    | 压缩/摘要                       | 遗忘                 | FreeAnima 映射                                                                                 | 不采用                            |
| ---------------- | ------------------------------------------------------------- | ------------------------------- | -------------------- | ---------------------------------------------------------------------------------------------- | --------------------------------- |
| **MemGPT/Letta** | Core memory blocks 常驻；agent 自编辑；Recall/Archival 工具拉 | 虚拟上下文；sleep-time 闲时整理 | 移出 core / 改走检索 | Self+常驻≈blocks；messages≈Recall；Semantic≈Archival；**顺序 memory-maintenance≈闲时整理角色** | agent 自控巩固流水线；自编辑 Self |
| **LangChain**    | Buffer / Window / Summary(Buffer) / Entity / Vector / KG      | Summary* LLM 压历史             | Window 丢旧消息      | 四段压缩≈SummaryBuffer；Semantic+cite≈Entity 强化                                              | Memory 插件动物园；全量 KG        |
| **LlamaIndex**   | `token_limit` + ratio；Composable 短+长                       | flush 超额进长期；SummaryBuffer | FIFO/flush           | 压缩 token 预算≈limit；常驻+被动≈Composable                                                    | compress 与 retain 绑死自动 flush |

已有管线对照（Hindsight / Mem0 / OpenViking / Hermes）仍以 [`memory.md` §五](memory.md) 为准。

---

## 四、可优化点与分期

| 期     | 内容                                                                           | 状态   |
| ------ | ------------------------------------------------------------------------------ | ------ |
| **P0** | 本页 + 交叉引用                                                                | 已落地 |
| **P1** | Working 预算可观测：`prompt.debug` → `system.fold` 段级 chars                  | 已落地 |
| **P2** | syncTurn 推进 retain watermark；stats 暴露 l2 vs tip；slim 保护 `[[anima:id]]` | 已落地 |
| **P3** | `memory.resident` / `memory.reference` 配置化；遗忘契约文档化                  | 已落地 |

**非目标**：LLM 控制 memory-maintenance；Letta 式自编辑 Self；跨类型统一 RRF；恢复 dream/浅深睡/DAG；压缩路径直接 retain 或硬拦边界。

### 遗忘契约（现行）

- **写库遗忘**：显式 `deprecate` / `unpin`（工具或运维）
- **常驻**：读时 pinned ∪ 高 `reference_count` TopN（`memory.resident.top_n` / `pinned_max`）；超 `pinned_max` 截断列表并 warn，**默认不写库 unpin**
- **cite 权重**：近 `memory.reference.decay_days` 日加权累加 `entities.reference_count`（`recent_weight` / `stale_weight`）；不自动 deprecate

评测挂载见风巢 #16041（LoCoMo 等）；实现见 [`scripts/eval/locomo/README.md`](../../scripts/eval/locomo/README.md)（compose PG+Redis + hybrid FTS；不写用户 `~/.anima/config.yaml`）。

---

## 五、术语表

| 说法               | 含义                                                   |
| ------------------ | ------------------------------------------------------ |
| Working            | 上下文窗口（系统提示 + 压缩四段 + 被动召回）           |
| Letta Core blocks  | 常驻可编辑块 ≈ Self 段 + 常驻语义（FA **程序侧**装配） |
| Recall（Letta）    | 可检索完整对话史 ≈ Habitat `messages`                  |
| Archival           | 长期知识 ≈ Semantic（+ Temporal）                      |
| memory-maintenance | 夜间顺序巩固；≠ agent sleep-time 自调度                |
| 压缩四段           | `system` / `summary` / `slim` / `raw`                  |
