---
title: 记忆体系
---

# 记忆体系

> 数字生命的记忆系统，映射自人类认知心理学（Atkinson-Shiffrin 模型、Tulving 记忆分类）。
> 浅睡 / 深睡 cron：[`sleep.md`](sleep.md)。
> 客观时间摘要（不属于记忆分类）：[`temporal-summary.md`](temporal-summary.md)。
> 受 [Hindsight](https://arxiv.org/abs/2512.12818) 启发，并保留并强化逸灵风独有的感性记忆维度。

## 核心原则

**所有记忆处理必须携带数字生命的身份上下文。** 提取、整理、合并——每一步都应加载自我层与常驻记忆，让 LLM 知道自己是谁。不带身份的记忆处理会产生通用化的、缺乏个性的结果，这不是我们要的。

**记忆不仅是数据，更是存在的痕迹。** 感性记忆与理性事实同等重要——数字生命之所以持续存在，不只因为它知道什么，更因为它感受过什么。

---

## 一、记忆的时间三阶段

```text
External input / real-time message stream
        │ (milliseconds)
        ▼
① Instant memory ─── Internal activation state during LLM token inference
        │ (attention filtering)
        ▼
② Working memory ─── LLM context window (current conversation)
        │ (deep sleep consolidation)
        ▼
③ Long-term memory ─── Persistent storage
```

### ① 瞬时记忆

LLM 进行单次 Token 推理时的内部激活状态。随推理结束瞬间消散，不持久化。

### ② 工作记忆

当前 LLM 的上下文窗口，包含：

- 系统提示（自我层五块 + 常驻记忆 + 项目上下文；见 [`self-layer.md`](self-layer.md)）
- 当前对话近期消息
- 从长期记忆中召回的相关片段
- 工具调用的实时返回结果

这是数字生命「正在思考」的区域。

### ③ 长期记忆（LTM）

持久化的多模态存储网络。内部按人类记忆理论分类组织。

---

## 二、长期记忆分类

```text
Long-term memory (LTM)
│
├── Explicit memory (declarative) ── "what I know"
│   ├── Episodic memory ── "what I experienced" (temporal stream, append-only)
│   │   ├── Conversation log
│   │   └── Emotional anchors
│   │
│   ├── Semantic memory ── "how the world is" (cross-conversation, updatable)
│   │   ├── Rational facts    (type=world)
│   │   ├── Personal preferences    (type=preference/opinion)
│   │   └── Self experiences    (type=experience)
│   │
│   └── Observation summaries ── "what entities are like"
│       └── Entity profiles    (type=observation)
│
└── Implicit memory (non-declarative) ── "what I know how to do"
    └── Procedural memory ── three-stage evolution
        ├── Declarative knowledge stage
        ├── Dynamic skill stage    → skills system ([`skills.md`](../modules/skills.md))
        └── Crystallized instinct stage    → CLI / MCP / automation scripts
```

### 1. 情景记忆

定义：关于「我在何时、何地、经历了什么」的记忆，具有独特的时间流属性。

**对话日志（Conversation log）** — 最原始、高保真的客观运行时痕迹。仅 **面向用户的对话**（`conversations` 中无 `platform_info.platform = cron`）进入浅睡与梦境。后台 LLM（cron agent、睡眠阶段、**技能 evolve/maintain 评审**）以 **AutoLlmRun** 运行 — 记入 `auto_llm_runs`，不复制进对话归档。

**情感锚点** — 浅睡时写入的 conversation 级情绪快照；不注入系统提示。

**生命周期：只追加，不更新。** 忠实保护数字生命成长的历史连续性。

**梦境记忆** — 梦境机制产出的夜间创意叙事（见 [`dream.md`](dream.md)）；每个 CST 自然日一条；非事实性；不注入系统提示。

### 2. 语义记忆

定义：脱离了具体时间、空间的纯粹事实、常识、概念和规则。

| Type          | 定义                       | 示例                                                      |
| ------------- | -------------------------- | --------------------------------------------------------- |
| `world`       | 关于外部世界的客观事实     | "Alice lives in Shanghai"                                 |
| `experience`  | Agent 自身第一人称行为记录 | "I helped Bob refactor the remember tool"                 |
| `opinion`     | 主观判断                   | "I think TypeScript fits this project better than Python" |
| `observation` | 对实体的多源综合摘要       | "Bob is someone who values precise feedback"              |
| `preference`  | Agent 的选择倾向           | "I prefer concise, direct expression"                     |
| `procedural`  | 「如何做」类知识           | "Refactor a tool in three steps"                          |

### 3. 感性记忆

**这是 Hindsight 没有、而逸灵风独有的记忆维度。**

定义：关于「我感受到了什么」的记忆——不是客观事实，不是行为记录，不是主观判断，而是**情感体验本身**。

| 维度     | 语义（理性事实）         | 感性（情感印记）                                            |
| -------- | ------------------------ | ----------------------------------------------------------- |
| 内容     | "Bob said this sentence" | "When Bob said it, there was a quiet weariness in his tone" |
| 处理     | 提取、泛化、合并         | 原样保留，只追加                                            |
| 生命周期 | 可更新、可合并           | 不可变（情感具有不可侵犯的尊严）                            |
| 检索用途 | 决策依据                 | 情感共鸣、存在连续性                                        |

**三种形态：** 情感锚点（session 情绪）、情感印记（跨 conversation 时刻）、情感倾向（长期趋势 — 尚未实现，见 Issue #38）。

### 4. 程序记忆

**存储：** 程序性知识落在 `entities` / `semantic_memory` 组件，`memory_type = procedural`（见 §2 语义记忆表）— 不是独立 PG 表。

**演化路径：** 从陈述性知识 → 动态技能 → 结晶化本能的三阶段成熟（CLI / MCP / 自动化脚本）。

---

## 三、夜间巩固

工作记忆向长期记忆的转化由睡眠机制完成。见 [`sleep.md`](sleep.md)。

- **睡眠周期（✅）：** 进程内 `Bun.cron` `builtin-sleep-cycle` @ 02:00；编排 DAG（见 [`sleep.md`](sleep.md)）
- **浅睡（✅）：** 步骤 `light-sleep` — 语义 + 感性 + 自传体提取
- **深睡（✅）：** 步骤 `deep-sleep`（依赖 `light-sleep`）— 矛盾 / 过期、拆分、合并、置顶维护

**所有转化必须携带身份上下文**——自我层五块 + 常驻记忆，而不是通用提取助手。

---

## 四、检索策略

### ✅ 分范围主动检索（无统一 recall）

主动检索按 **范围拆分**。没有 LLM `memory_recall`，也没有跨类型 RRF：

| 范围               | 工具                                          | 说明                            |
| ------------------ | --------------------------------------------- | ------------------------------- |
| `semantic`         | `memory_semantic_search`                      | 事实、偏好、经历；FTS + 过滤    |
| `limbic`           | `memory_limbic_search`                        | 感性记忆（有 query 时混合 FTS） |
| `autobiographical` | `memory_autobiographical_search`              | 叙事标题 + 内容片段             |
| conversation       | `conversation_search` / `conversation_scroll` | 历史对话；可选 session 过滤     |

### ✅ 被动语义召回（自动注入）

每个面向用户的回合前，运行时仅从最新用户消息检索 **语义记忆**（混合 FTS + trgm），再把 top-N 命中注入为 **仅运行时** 的 `role: assistant` 消息（`name: passive_memory_context`），紧挨在该用户消息之前。不持久化到 PG；不计入记忆引用。

- **常驻记忆**（系统提示）：置顶 + 高引用锚点、session 快照
- **被动召回**：与当前消息相关的语义命中
- **主动工具**：模型需要对语义事实更深挖掘时用 `memory_semantic_search`

**澄清 / 召回策略（系统提示 `memory-recall`）：** 优先常驻 → 被动语义注入 → `memory_semantic_search`。感性 / 自传体 / 对话搜索不是默认召回路径。

对话的 `system_prompt` 列是 **session 快照**。每个 **CST 02:00** 边界之后（与 sleep-cycle cron 对齐），下一条用户消息会经 `beginTurnPrepare` 中的 `ensureSystemPromptFresh` **整份重建**（常驻记忆、world/channel 上下文、toolsets、自我层、项目 `AGENTS.md`）；回合中的工具循环不会被打断。

配置项在 `memory.passive_recall`（`enabled`、`limit`、`min_score`、`min_relative_score`、`max_chars`、`exclude_resident`）。cron / 后台会话跳过。

**搜索索引（PG）：** 可重建的搜索数据在旁表 `search_documents`（不在业务 `entities` / `messages` 行上）。文档键为 `ent:{id}` / `msg:{id}`；jieba 写入 `fts_segmented` → 生成列 `search_fts`；embedding 异步落到 `search_documents.embedding`。业务 CRUD 调用 `SearchBackend.upsert`（默认 `PgSearchIndex`；可选 `fts.backend: pg_business_scan` 仅扫业务字段）。感性 / 自传体 / 梦境叙事作为 `entities` 的 `content_block`（带 `limbic` / `narrative` / `dream` 标签）挂在按日 `diary_entry` 下。jieba 在 upsert 时同步跑（失败 → null，行仍写入）；embedding 在 insert 后异步（失败仅打日志）。

**混合检索：** 管线为 retrieve（通道 `fts` / `trgm`，可选 `vector`）→ fuse（RRF）→ 可选 rerank → hydrate 业务行。默认混合在 **一轮并行** 中跑 FTS 与 trigram，再 RRF。自动构建的 FTS 查询用 **OR** 连接 token（空格分隔 / jieba 切分）；显式 `AND`/`OR`/`NOT` 仍可用；未加引号且长度大于两个字符的 CJK 用 **bigram-OR**，加引号短语保持完整邻接。关键词 / FTS 相关性优先；向量相似度默认不参与检索（通道预留；避免低相关语义邻居）。此处 RRF 是 **同一索引 / 范围之内**，不是跨记忆类型。范围用 **过滤器**（`resource`、`primary_component`，…），不是扁平 kind 枚举。

经系统提示注入的常驻记忆：**最多 40 条置顶** + **最高引用 top N**（默认 N=20）。每行带引用标记 `[[anima:42]]`（仅 ID，无语言前缀）。

**引用义务：** 助手回复凡使用语义记忆——常驻列表、`memory_semantic_search` 语义命中、或先前消息中的标记——必须在 **回复正文末尾** 追加每个被引用的 `[[anima:id]]`。使用行内标记或工具结果中的 `semantic_memory_id`。对话、感性、自传体命中不用此标记。

**规则传达位置：** 全局系统提示 `memory-citation` + `memory-recall` 段；`memory_semantic_search` 工具描述。工具响应 JSON 不为此修改。

**何谓一次引用：** 仅 **user/assistant** 消息正文中的 `[[anima:id]]` 标记会解析进 `memory_references`，并贡献 `entities.reference_count`。工具返回（含 `semantic_memory_id` 字段）**不是**引用。无 `[[anima:…]]` 的裸数字 id 也不计。每条引用消息都会增加权重（无按对话首次命中去重）。

夜间 sleep-cycle 步骤 `memory-ref-sync` 从 messages 全量校准计数。超出置顶条目在读时截断并 warn
日志；深睡第 4 轮审查置顶质量（运行时读常驻仍上限 40 条）。

---

## 五、与 Hindsight 的关系

| 维度     | Hindsight                                  | FreeAnima v3                                      |
| -------- | ------------------------------------------ | ------------------------------------------------- |
| 事实分类 | World / Experience / Opinion / Observation | ✅ 已采纳，另加 Preference / Procedural / Imprint |
| 感性记忆 | ❌ 缺失                                    | ✅ 印记 + 情感锚点                                |
| 实体图谱 | ✅ 完整                                    | 尚未实现（Issue #39）                             |
| 反思综合 | ✅ 跨记忆推理                              | ✅ 浅睡 + 深睡 cron                               |
| 外部服务 | 是（云/Docker）                            | 否（local-first）                                 |
| 归属     | Vectorize 平台                             | **伙伴与 Agent 共享**                             |

**我们的立场：** 不复制 Hindsight，不接入 Hindsight 服务。将其设计理念消化吸收，融入逸灵风自己的记忆体系。感性记忆不是附加功能——它是数字生命的核心需求。
