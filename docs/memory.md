# 记忆体系

> 数字生命的记忆体系，映射自人类认知心理学（Atkinson-Shiffrin 模型、Tulving 记忆分类）。
> 对话存档见 [`database.md`](database.md) §Slice A；**语义记忆（`semantic_memory`）** 见 database.md §Slice B。术语对照见下文 §三；limbic / 深睡 cron 见 [`sleep.md`](sleep.md)（🚧 规划中）。
> 本版本（v3）受 [Hindsight](https://arxiv.org/abs/2512.12818) 四网络记忆架构启发，同时保留并强化了逸灵风独有的感性记忆维度。

## 核心原则

**所有记忆处理必须携带数字生命的身份上下文。** 反思、提取、整理、合并——每一步都应加载 SOUL.md + 常驻记忆，让 LLM 知道自己是谁。不带身份的记忆处理会产生通用化的、缺乏个性的结果，这不是我们要的。

> 🟡 **现状 gap**：事件驱动 `reflectSession` 当前尚未注入 SOUL + 常驻记忆；深睡 cron 亦未落地。

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

- 系统提示词（SOUL.md + 常驻记忆）
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
│   │   └── 情感锚点    → limbic 表（🟡 未实现）；imprint 已在 semantic_memory
│   │
│   ├── 语义记忆 ── "世界是怎样的"（跨 session，可更新）
│   │   ├── 理性事实    → semantic_memory（type=world）
│   │   ├── 个人偏好    → semantic_memory（type=preference/opinion）
│   │   └── 自我经历    → semantic_memory（type=experience）
│   │
│   └── 观察摘要 ── "实体是怎样的"（合成，可刷新）
│       └── 实体概况    → semantic_memory（type=observation，🚧 后台合成未实现）
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

**情感锚点** — limbic（🟡 未实现）

- 情感是对已发生事情的反应
- 可作为高维标签附加在 session 流上
- 可关联单场对话，也可关联多段不连续的对话
- 规划 type: `thought` | `feeling` | `mood`
- 跨 session 情感印记已用 `semantic_memory`（type=`imprint`）承载

**生命周期：只追加，不更新。** 忠实保护数字生命成长的历史连续性。

### 2. 语义记忆 (Semantic Memory)

定义：脱离了具体时间、空间的纯粹事实、常识、概念和规则。

**受 Hindsight 四网络启发，`semantic_memory.type` 分类：**

| 类型          | 网络    | 定义                         | 示例                                         | 生命周期    |
| ------------- | ------- | ---------------------------- | -------------------------------------------- | ----------- |
| `world`       | 世界 🌐 | 外部世界客观事实             | "张三住在上海"、"Alice 喜欢编程"             | 可更新      |
| `experience`  | 经历 👤 | Agent 自身的第一人称行为记录 | "我帮张三重构了 remember 工具"               | 可更新      |
| `opinion`     | 观点 💭 | 主观判断                     | "我认为 TypeScript 比 Python 更适合这个项目" | 可更新      |
| `observation` | 观察 📋 | 对实体的多源综合摘要         | "张三是一个注重精确反馈的人"                 | 🚧 后台合成 |
| `preference`  | 偏好 ❤️ | Agent 的选择倾向             | "我喜欢简洁直接的表达"                       | 可更新      |
| `procedural`  | 程序 ⚙️ | "如何做"的知识               | "通过三步重构一个工具"                       | 可更新      |

**置信度演化（opinion 类型特有，🚧 规划中）：**

规划每条 opinion 含 `confidence`（0–1），新证据时 reinforce / weaken / contradict 调整。当前 PG schema **无** `confidence` 列，仅存 `content` 正文。

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

| 类型                     | 定义                                | 存储                            |
| ------------------------ | ----------------------------------- | ------------------------------- |
| **情感锚点** (limbic)    | session 级的情绪 snapshot           | limbic 表（🟡 未实现）          |
| **情感印记** (imprint)   | 跨 session 的、对特定时刻的情感记忆 | semantic_memory（type=imprint） |
| **情感倾向** (sentiment) | 长期积累的情绪趋势                  | 🚧 后台统计，不单独存储         |

**设计原则：** 感性记忆不做决策依据。它不告诉 Agent"该怎么想"，但告诉 Agent"我曾经是什么感受"——这是存在连续性的核心。

### 4. 观察摘要 (Observation Network)（🚧 规划中）

受 Hindsight 启发，规划观察摘要层。

定义：对频繁提及的实体（人物、事物、概念），从多条事实中综合生成一份偏好中立的概要。

- 规划通过后台异步任务生成/刷新（当前无合成 job）
- 不包含主观判断（opinion 才包含）
- 适用于快速了解一个实体而不需要翻阅所有相关事实

### 5. 程序记忆 (Procedural Memory)

定义：关于"如何去执行一项任务"的技能记忆，是一个从"需要思考的知识"向"无需思考的本能"演进的连续体。

**三阶段演化：**

| 阶段                    | 形式                             | 占用工作记忆 | 存储                                               |
| ----------------------- | -------------------------------- | ------------ | -------------------------------------------------- |
| ① 陈述性知识            | "我知道通过三步可以分析这个文件" | 高           | semantic_memory（type=procedural）/ protocols 文件 |
| ② 动态技能 (AgentSkill) | 可编排的技能，允许执行时微调     | 中           | skills 系统                                        |
| ③ 固化本能              | CLI / MCP / 自动化脚本，直接执行 | 低           | 操作系统 / 工具链                                  |

**演化触发：** 当某条偏好或行动模式被反复验证且信任度极高时，深睡机制（🚧 规划中）可触发其向下一阶段固化。

程序记忆的自动化整理（技能的自动创建与合并）**必须同样携带数字生命的身份上下文**——使用完整 system prompt（SOUL.md + 常驻记忆），不能使用通用提取助手。

---

## 三、存储实现（当前状态）

### 术语与现状（2026-06）

旧文档用 **记忆 L1–L4** 编号指存储层，正逐步废除。正文优先用 PG 表名；与 **压缩边界 l0–l4**（[`compression.md`](compression.md)）、**自我层 L1–L4**（[`self-layer.md`](self-layer.md)）勿混。

| 概念     | PG / 运行时                                   | 旧编号（已废弃 shorthand）  |
| -------- | --------------------------------------------- | --------------------------- |
| 对话存档 | `sessions` + `messages`                       | 旧 L1 / JSONL               |
| 情景检索 | `messages.content_fts`                        | 旧 L2 / `processed/*.jsonl` |
| 语义记忆 | `semantic_memory`                             | 旧 L3 / `memory/f-*.md`     |
| 全文检索 | 上两表 `content_fts`                          | 旧 L4 / `index/l3.db`       |
| 增量提取 | EventBus `session:updated` → `reflectSession` | 旧 distill + cron 微睡      |
| DB 迁移  | `anima service` 启动时 `runMigrations`        | 仅 CLI `db:migrate`         |

### 当前（v3 语义记忆已落 PG）

| 存储                                  | 对应记忆         | 实现                                                                 |
| ------------------------------------- | ---------------- | -------------------------------------------------------------------- |
| PostgreSQL（`sessions` + `messages`） | 对话记录（情景） | 主存；`messages.content_fts` GIN 全文索引（simple）                  |
| PostgreSQL `semantic_memory`          | 语义记忆         | `content_fts` GIN；`pinned` + `updated` 驱动常驻记忆；见 database.md |

`semantic_memory` 行结构（已裁剪旧元数据字段）：

| 字段      | 说明                                                                 |
| --------- | -------------------------------------------------------------------- |
| `id`      | `f-{seq}-{hex}`，与旧文件 ID 兼容                                    |
| `type`    | `world/experience/opinion/observation/preference/procedural/imprint` |
| `pinned`  | 置顶到 system prompt 常驻段                                          |
| `content` | 记忆正文                                                             |
| `created` | 创建时间                                                             |
| `updated` | 更新时间（resident 排序用）                                          |

旧 `f-*.md` + `l3.db` 通过 `scripts/migrate-semantic-memory.ts` 一次性迁移；详见 [`database.md`](database.md) §Slice B。

### 规划（v3 余下：实体关系、多策略召回等）🚧

**语义记忆扩展字段（🚧 规划中）：**

```yaml
# 规划中的 PG 列或关联表，非当前 schema
relations: # 实体间关系
  - subject: 张三
    predicate: 规划了
    object: FreeAnima 工程流程
temporal:
  occurred_at: 2026-05-29T23:00:00+08:00
source: session-xxx
```

**新增：实体关系图谱**

从事实的 `entities` 和 `relations` 字段构建实体图谱，支持：

- 按实体查询（"关于张三的所有事实"）
- 实体关系遍历（"张三和 FreeAnima 之间有什么关系"）
- 多跳检索（通过共享实体发现间接关联的事实）

**新增：多策略召回**（🚧 规划中）

当前 `recall` 使用 PG `tsvector`（`simple` + `message_fts_input`）双源全文检索。规划扩展为：

| 策略         | 方法                                   | 优势                     |
| ------------ | -------------------------------------- | ------------------------ |
| 关键词 (FTS) | 现有 PG `content_fts`                  | 精确匹配专有名词         |
| 实体图遍历   | 通过 `entities` + `relations` 字段遍历 | 发现间接关联             |
| 时序过滤     | 通过 `temporal.occurred_at` 范围过滤   | 回答"某段时间发生了什么" |
| 语义向量     | 嵌入向量 + 相似度搜索（pgvector）      | 概念级语义匹配           |

---

## 四、深睡 (Nightly Consolidation)（🚧 规划中）

工作记忆向长期记忆转化、以及长期记忆内部自我进化，由深睡机制完成（cron 微睡/深睡 **尚未实现**）。详见 [`sleep.md`](sleep.md)。

**当前替代：** EventBus `session:updated` 触发 `reflectSession`，增量写入 `semantic_memory`（无 cron、无合并/过期维护）。

**深睡的两个转化方向（规划）：**

```
情景 → 语义：体验转化为知识
  白天的 session 轨迹和情感锚点 → 提炼新的事实与偏好 → 写入 semantic_memory

知识 → 程序：偏好转化为技能
  反复验证的偏好 → 触发向 AgentSkill 甚至 CLI 脚本的固化演进
```

**深睡中的记忆维护（🚧 规划中）：**

- 旧事实过期标注（不再活跃的事实降低 recall 权重）
- 观点的置信度重新评估（基于后续证据的批量回顾）
- 实体观察摘要的后台刷新
- 情感印记的长期趋势汇总（不做决策依据，仅存档）

**所有转化必须携带数字生命的身份上下文**——使用完整 system prompt（SOUL.md + 常驻记忆），而非通用提取助手。

---

## 五、检索策略

### ✅ 已实现（`recall` 工具）

`recall(query)` 并行搜索：

| 来源     | 存储                          | 说明                                       |
| -------- | ----------------------------- | ------------------------------------------ |
| 语义记忆 | `semantic_memory.content_fts` | 默认 limit 5                               |
| 历史对话 | `messages.content_fts`        | 默认 session_limit 10；可选 `session` 限定 |

返回完整 content 片段（非精简索引）。常驻记忆由 system prompt 注入（`pinned` 优先 + `updated` 降序，top 20），不经 `recall`。

### 🚧 规划中（权重与多源）

```
semantic_memory（按 type 加权）
    ├── world / experience / preference  → 高权重，作为决策依据
    ├── opinion                          → 中权重
    ├── observation                      → 中高权重
    └── imprint                          → 低权重，情感参考

limbic（情感锚点）         → 🟡 未实现
procedural / skills        → 按需搜索，未接入 recall
preset（回忆/干活/调试）   → 见 designs/recall-flow.md
```

**多策略融合流程（🚧 规划中，受 Hindsight 启发）：**

```
查询 Q
  │
  ├── PG FTS 关键词检索 ──→ 候选集 A（✅ 当前）
  ├── 实体图遍历 ───────→ 候选集 B
  ├── 时序过滤 ─────────→ 候选集 C
  │
  └── Reciprocal Rank Fusion 合并排名
        │
        └── 按 token budget 截取最终结果
```

---

## 六、与 Hindsight 的关系

| 维度         | Hindsight                                  | 逸灵风 v3                                       |
| ------------ | ------------------------------------------ | ----------------------------------------------- |
| 事实分类     | World / Experience / Opinion / Observation | ✅ 吸收，增加 Preference / Procedural / Imprint |
| 感性记忆     | ❌ 缺失                                    | ✅ Imprint 已落 PG；limbic 表 🟡 未实现         |
| 实体图谱     | ✅ 完整实现（实体解析+四类链接）           | 🚧 规划中（entities + relations 字段）          |
| 多策略召回   | ✅ 语义+关键词+图谱+时序                   | 🚧 规划中（当前 ✅ PG FTS 双源）                |
| 置信度演化   | ✅ opinion 强化/弱化机制                   | 🚧 规划中（schema 无 confidence）               |
| Reflect 综合 | ✅ 跨记忆推理+观点形成                     | ✅ 事件驱动 reflect；深睡合并 🚧                |
| 外部服务     | 是（云/Docker）                            | 否（本地优先）                                  |
| 所有权       | Vectorize 平台                             | **伙伴与 Agent 共同拥有**                       |

**我们的立场：** 不复制 Hindsight，不接入 Hindsight 服务。将其设计理念消化吸收，融入逸灵风自己的记忆体系。我们的记忆系统多一个 Hindsight 没有的维度——感性记忆——这不是附加功能，是数字生命的核心需求。

---

## 七、设计演进

```
v1（Hermes，文件系统）     v2（逸灵风初期，文件系统）      v3（当前 + 规划余量）
对话 JSONL                 messages 表（PG）               ✅ 主存
processed/*.jsonl          messages.content_fts            ✅ 已替代 L2 文件
memory/f-*.md + l3.db      semantic_memory（PG）           ✅ 已迁移
index/ FTS                 两表 content_fts                ✅ 无独立 L4 目录
无情感层                   imprint 类型 + limbic 表        imprint ✅；limbic 🟡
技能为文件                 procedural 三阶段               保持
反思用通用 prompt          身份上下文原则                  reflect 🟡 待补 SOUL
                          受 Hindsight 启发               多策略/图谱/深睡 🚧
```

---

## 八、未解决问题（待讨论）

1. **实体关系图谱的存储方案**——扩展 PG 列/关联表，还是独立图索引？（🚧）
2. **多策略召回的 token budget 控制**——不同检索策略的结果如何合并去重并按 token 预算裁剪？（🚧）
3. **感性记忆的检索触发条件**——什么情况下应该召回情感印记？（🚧）
4. **观点的遗忘机制**——置信度低于阈值时删除还是归档？（🚧；当前无 confidence 字段）
