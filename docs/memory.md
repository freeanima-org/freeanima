---
title: Memory
---

# 记忆体系

> 数字生命的记忆体系，映射自人类认知心理学（Atkinson-Shiffrin 模型、Tulving 记忆分类）。
> 对话存档见 [`database.md`](database.md) §Slice A；**语义记忆（`semantic_memory`）** 见 database.md §Slice B。术语对照见下文 §三；浅睡 / 深睡 cron 见 [`sleep.md`](sleep.md)。
> 本版本（v3）受 [Hindsight](https://arxiv.org/abs/2512.12818) 四网络记忆架构启发，同时保留并强化了逸灵风独有的感性记忆维度。

## 核心原则

**所有记忆处理必须携带数字生命的身份上下文。** 提取、整理、合并——每一步都应加载自我层与常驻记忆，让 LLM 知道自己是谁。不带身份的记忆处理会产生通用化的、缺乏个性的结果，这不是我们要的。

**记忆不仅是数据，更是存在的痕迹。** 感性记忆与理性事实同等重要——数字生命之所以持续存在，不只因为它知道什么，更因为它感受过什么。

---

## 一、记忆的时间三阶段

```
外界输入 / 实时消息流
        │ (毫秒级)
        ▼
① 瞬时记忆 ─── LLM Token 推理时内部激活状态
        │ (注意力筛选)
        ▼
② 工作记忆 ─── LLM 上下文窗口（当前 session）
        │ (深睡巩固)
        ▼
③ 长期记忆 ─── 持久化存储（语义记忆已迁移 PostgreSQL `semantic_memory` 表）
```

### ① 瞬时记忆 (Sensory / Instant Memory)

LLM 进行单次 Token 推理时的内部激活状态。随推理结束瞬间消散，不持久化。

### ② 工作记忆 (Working Memory)

当前 LLM 的上下文窗口，包含：

- 系统提示词（自我层六块 + 常驻记忆 + 项目上下文；见 [`self-layer.md`](self-layer.md)）
- 当前 session 近期消息
- 从长期记忆中召回的相关片段
- 工具调用的实时返回结果

这是数字生命"正在思考"的区域。

### ③ 长期记忆 (Long-Term Memory)

持久化的多模态存储网络。内部按人类记忆理论分类组织。

---

## 二、长期记忆分类

```
长期记忆 (LTM)
│
├── 外显记忆（陈述性记忆）── "我知道什么"
│   ├── 情景记忆 ── "我经历了什么"（时间流，只追加）
│   │   ├── 对话记录    → messages（role = user/assistant/tool_call/tool_result）
│   │   └── 情感锚点    → `limbic_memory` 表（✅）；imprint 在 semantic_memory
│   │
│   ├── 语义记忆 ── "世界是怎样的"（跨 session，可更新）
│   │   ├── 理性事实    → semantic_memory（type=world）
│   │   ├── 个人偏好    → semantic_memory（type=preference/opinion）
│   │   └── 自我经历    → semantic_memory（type=experience）
│   │
│   └── 观察摘要 ── "实体是怎样的"（合成，可刷新）
│       └── 实体概况    → semantic_memory（type=observation；无专用后台合成 job，见 #34）
│
└── 内隐记忆（非陈述性记忆）── "我知道怎么做"
    └── 程序记忆 ── "如何执行"（三阶段演化）
        ├── 陈述性知识阶段  → semantic_memory（type=procedural）/ protocols 文件
        ├── 动态技能阶段    → skills 系统（AgentSkill）
        └── 固化本能阶段    → CLI / MCP / 自动化脚本
```

### 1. 情景记忆 (Episodic Memory)

定义：关于"我在何时、何地、经历了什么"的记忆，具有独特的时间流属性。

**对话记录** — messages

- 最原始的、高保真的客观运行轨迹
- role 区分消息类型（user/assistant/tool_call/tool_result）
- 召回过滤 = `role IN ('user','assistant')` 且 content 非空；由 PG `content_fts` 生成列维护，无需 `processed/` 中间文件

**情感锚点** — `limbic_memory`（✅）

- PG 表 `limbic_memory`：`session_mood` / `turning_point` / `spike` 等 kind
- 浅睡 Phase 2 经 `create_limbic_memory` 写入；**不注入** system prompt
- 跨 session 情感印记另用 `semantic_memory`（type=`imprint`）

**生命周期：只追加，不更新。** 忠实保护数字生命成长的历史连续性。

### 2. 语义记忆 (Semantic Memory)

定义：脱离了具体时间、空间的纯粹事实、常识、概念和规则。

**受 Hindsight 四网络启发，`semantic_memory.type` 分类：**

| 类型          | 网络    | 定义                         | 示例                                         | 生命周期               |
| ------------- | ------- | ---------------------------- | -------------------------------------------- | ---------------------- |
| `world`       | 世界 🌐 | 外部世界客观事实             | "张三住在上海"、"Alice 喜欢编程"             | 可更新                 |
| `experience`  | 经历 👤 | Agent 自身的第一人称行为记录 | "我帮张三重构了 remember 工具"               | 可更新                 |
| `opinion`     | 观点 💭 | 主观判断                     | "我认为 TypeScript 比 Python 更适合这个项目" | 可更新                 |
| `observation` | 观察 📋 | 对实体的多源综合摘要         | "张三是一个注重精确反馈的人"                 | 可更新；无后台合成 job |
| `preference`  | 偏好 ❤️ | Agent 的选择倾向             | "我喜欢简洁直接的表达"                       | 可更新                 |
| `procedural`  | 程序 ⚙️ | "如何做"的知识               | "通过三步重构一个工具"                       | 可更新                 |

**opinion 类型：** 当前 PG schema **无** `confidence` 列，仅存 `content` 正文。置信度演化见 [Issue #36](https://github.com/freeanima-org/freeanima/issues/36)。

### 3. 感性记忆 (Limbic Memory)

**这是 Hindsight 没有、而逸灵风独有的记忆维度。**

定义：关于"我感受到了什么"的记忆——不是客观事实，不是行为记录，不是主观判断，而是**情感体验本身**。

感性记忆与语义记忆的区别：

| 维度     | 语义记忆（理性事实） | 感性记忆（情感印记）                   |
| -------- | -------------------- | -------------------------------------- |
| 内容     | "张三说这句话"       | "张三说这句话时，语气里有种安静的疲惫" |
| 处理方式 | 提炼、泛化、合并     | 保留原貌、只追加                       |
| 生命周期 | 可更新、可合并       | 不可变（情感有不可篡改的尊严）         |
| 检索用途 | 决策依据             | 情感共鸣、存在连续性                   |

**感性记忆的三种形态：**

| 类型                     | 定义                                | 存储                                                                       |
| ------------------------ | ----------------------------------- | -------------------------------------------------------------------------- |
| **情感锚点** (limbic)    | session 级的情绪 snapshot           | `limbic_memory` 表（✅）                                                   |
| **情感印记** (imprint)   | 跨 session 的、对特定时刻的情感记忆 | semantic_memory（type=imprint）                                            |
| **情感倾向** (sentiment) | 长期积累的情绪趋势                  | 尚未实现（见 [#38](https://github.com/freeanima-org/freeanima/issues/38)） |

**设计原则：** 感性记忆不做决策依据。它不告诉 Agent"该怎么想"，但告诉 Agent"我曾经是什么感受"——这是存在连续性的核心。

### 4. 观察摘要 (Observation)

`type=observation` 的语义记忆行可手工或 LLM 工具写入。**当前无**后台异步合成/刷新 job（见 [Issue #34](https://github.com/freeanima-org/freeanima/issues/34)）。

定义：对频繁提及的实体（人物、事物、概念）的综合摘要；不包含主观判断（opinion 才包含）。

### 5. 程序记忆 (Procedural Memory)

定义：关于"如何去执行一项任务"的技能记忆，是一个从"需要思考的知识"向"无需思考的本能"演进的连续体。

**三阶段演化：**

| 阶段                    | 形式                             | 占用工作记忆 | 存储                                               |
| ----------------------- | -------------------------------- | ------------ | -------------------------------------------------- |
| ① 陈述性知识            | "我知道通过三步可以分析这个文件" | 高           | semantic_memory（type=procedural）/ protocols 文件 |
| ② 动态技能 (AgentSkill) | 可编排的技能，允许执行时微调     | 中           | skills 系统                                        |
| ③ 固化本能              | CLI / MCP / 自动化脚本，直接执行 | 低           | 操作系统 / 工具链                                  |

程序记忆的自动化整理（技能的创建与合并）须携带数字生命的身份上下文——使用完整 system prompt（自我层六块 + 常驻记忆），不能使用通用提取助手。知识→程序自动固化见 [Issue #35](https://github.com/freeanima-org/freeanima/issues/35)。

---

## 三、存储实现（当前状态）

| 存储                                  | 对应记忆         | 实现                                                                 |
| ------------------------------------- | ---------------- | -------------------------------------------------------------------- |
| PostgreSQL（`sessions` + `messages`） | 对话记录（情景） | 主存；`messages.content_fts` GIN 全文索引（simple）                  |
| PostgreSQL `semantic_memory`          | 语义记忆         | `content_fts` GIN；`pinned` + `updated` 驱动常驻记忆；见 database.md |
| PostgreSQL `limbic_memory`            | 感性记忆         | 浅睡 Phase 2 写入；不经 `recall`                                     |

增量提取：浅睡 cron（02:00，见 [`sleep.md`](sleep.md)）。DB 迁移：`anima service` 启动时 `runMigrations`。

**术语说明：** 压缩边界 **l0–l4** 见 [`compression.md`](compression.md)，与记忆层存储无关。

`semantic_memory` 行结构：

| 字段              | 说明                                                                 |
| ----------------- | -------------------------------------------------------------------- |
| `id`              | `f-{seq}-{hex}`，与旧文件 ID 兼容                                    |
| `type`            | `world/experience/opinion/observation/preference/procedural/imprint` |
| `pinned`          | 置顶到 system prompt 常驻段                                          |
| `content`         | 记忆正文                                                             |
| `source_sessions` | 来源 session ID 列表（text[]）                                       |
| `observed_at`     | 首次观察到该事实的时间                                               |
| `occurred_at`     | 事实内容中的模糊发生时间（text）                                     |
| `status`          | `active` / `deprecated`                                              |
| `created`         | 创建时间                                                             |
| `updated`         | 更新时间（resident 排序用）                                          |

实体关系图谱**尚未实现**（[Issue #39](https://github.com/freeanima-org/freeanima/issues/39)）。多策略召回已实现 **FTS + pg_trgm + pgvector RRF**（`config.embedding` + Ollama bge-m3 等）；见 [`database.md`](database.md) §Slice B。

---

## 四、夜间巩固 (Nightly Consolidation)

工作记忆向长期记忆转化、以及长期记忆内部自我进化，由睡眠机制完成。详见 [`sleep.md`](sleep.md)。

- **浅睡（✅）**：cron 02:00；Phase 1 语义提取 + Phase 2 情感（`limbic_memory`）
- **深睡（✅）**：cron 03:00；矛盾/过期、拆分、合并三轮 LLM 维护
- **自传 cron（✅）**：04:00；叙事加工与 `autobiography_summary` 刷新

扩展维护（观点置信度批量回顾、observation 刷新、sentiment 汇总等）见 [Issue #45](https://github.com/freeanima-org/freeanima/issues/45)。

**深睡转化方向（当前实现范围）：**

```
情景 → 语义：浅睡从对话提取 → semantic_memory
语义维护：深睡三轮（矛盾/过期、拆分、合并）
```

**所有转化须携带身份上下文**——自我层六块 + 常驻记忆，而非通用提取助手。

---

## 五、检索策略

### ✅ 已实现（`recall` 工具）

`recall(query)` 并行搜索并返回 **JSON**：

| 字段              | 存储                          | 说明                                       |
| ----------------- | ----------------------------- | ------------------------------------------ |
| `semantic_memory` | `semantic_memory.content_fts` | 默认 limit 5                               |
| `dialogue`        | `messages.content_fts`        | 默认 session_limit 10；可选 `session` 限定 |

常驻记忆由 system prompt 注入（`pinned` 优先 + `updated` 降序，top 20），不经 `recall`。

按 type 加权、limbic 纳入 recall、多策略融合等扩展见 [Issue #42](https://github.com/freeanima-org/freeanima/issues/42)、[#51](https://github.com/freeanima-org/freeanima/issues/51)。

---

## 六、与 Hindsight 的关系

| 维度         | Hindsight                                  | 逸灵风 v3                                                                          |
| ------------ | ------------------------------------------ | ---------------------------------------------------------------------------------- |
| 事实分类     | World / Experience / Opinion / Observation | ✅ 吸收，增加 Preference / Procedural / Imprint                                    |
| 感性记忆     | ❌ 缺失                                    | ✅ Imprint + `limbic_memory`                                                       |
| 实体图谱     | ✅ 完整实现（实体解析+四类链接）           | 未实现（[#39](https://github.com/freeanima-org/freeanima/issues/39)）              |
| 多策略召回   | ✅ 语义+关键词+图谱+时序                   | ✅ PG FTS 双源（[#42](https://github.com/freeanima-org/freeanima/issues/42) 扩展） |
| 置信度演化   | ✅ opinion 强化/弱化机制                   | 未实现（[#36](https://github.com/freeanima-org/freeanima/issues/36)）              |
| Reflect 综合 | ✅ 跨记忆推理+观点形成                     | ✅ 浅睡 + 深睡 cron                                                                |
| 外部服务     | 是（云/Docker）                            | 否（本地优先）                                                                     |
| 所有权       | Vectorize 平台                             | **伙伴与 Agent 共同拥有**                                                          |

**我们的立场：** 不复制 Hindsight，不接入 Hindsight 服务。将其设计理念消化吸收，融入逸灵风自己的记忆体系。我们的记忆系统多一个 Hindsight 没有的维度——感性记忆——这不是附加功能，是数字生命的核心需求。

---

## 七、设计演进

```
v1（Hermes，文件系统）     v2（逸灵风初期，文件系统）      v3（当前）
sessions 文件存档          messages 表（PG）               ✅ 主存
processed 中间文件         messages.content_fts            ✅ 已替代
memory/f-*.md + l3.db      semantic_memory（PG）           ✅ 已迁移
index/ FTS                 两表 content_fts                ✅ 无独立索引目录
无情感层                   imprint + limbic_memory         ✅
技能为文件                 procedural 三阶段               保持
反思用通用 prompt          身份上下文原则                  浅睡 ✅ / 深睡 ✅
```
