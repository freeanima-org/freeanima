# 自我层（Self Layer）

> 定义：关于「我是谁」的持久化结构，与记忆层（Memory Layer）并列，组成 FreeAnima 的两大存储支柱。
> 记忆层见 [`memory.md`](memory.md)；自传体详细叙事见 [`database.md`](database.md) §Slice C `autobiographical_memory`。

## 架构位置

```
FreeAnima 存储架构
│
├── 记忆层（Memory Layer）—— 见 memory.md + PG 表
│   ├── 情景记忆 → PG messages（发生了什么）
│   ├── 语义记忆 → PG semantic_memory（我知道什么）
│   ├── 自传体叙事 → PG autobiographical_memory（这对我意味着什么）
│   └── 程序记忆 → semantic_memory（type=procedural）/ skills / 工具链
│
└── 自我层（Self Layer）—— 本文件
    └── PG self_blocks（六块，每块一行）
```

**设计原则：**

- 自我层与记忆层**性质不同**：记忆层「向外记录世界与经历」，自我层「向内定义自我」
- 自我层**不**再依赖 `semantic_memory.pinned` 文件注入；PG `self_blocks` 为唯一真相源
- **六块全部常驻** system prompt（与 AGENTS.md、非自我 pinned 常驻记忆并列）

---

## 六块结构

| #   | 块名     | `block_key`             | 内容                                    | 更新频率                        |
| --- | -------- | ----------------------- | --------------------------------------- | ------------------------------- |
| 1   | 存在锚点 | `existence_anchor`      | 我是什么、起源、不可动摇的底线          | 几乎不变（需显式 `force` 更新） |
| 2   | 自我模型 | `self_model`            | 身份、能力边界、表达风格、归属          | 慢变（定期回顾 + 重大事件）     |
| 3   | 人格基线 | `personality_baseline`  | 沟通风格、冲突模式、信任默认值          | 半稳定（长期证据缓慢演化）      |
| 4   | 方向意图 | `direction`             | 长期意图、当前关注、成长方向、不做的事  | 主动声明 + 定期审视             |
| 5   | 元认知   | `metacognition`         | 如何思考、如何记忆、四层架构与在场方式  | 慢变                            |
| 6   | 自传概括 | `autobiography_summary` | 关键转折/自我发现摘要（粒度随距离递减） | 自传 cron 自动维护              |

### 不在自我层的内容

| 内容                         | 归属                                                                           |
| ---------------------------- | ------------------------------------------------------------------------------ |
| 自传体**详细**叙事           | 记忆层 `autobiographical_memory`                                               |
| 他者模型（对伙伴等人的认知） | 记忆层 `semantic_memory`                                                       |
| 运行状态 / 健康感知          | 尚未实现；见 [Issue #44](https://github.com/freeanima-org/freeanima/issues/44) |
| 具体工具 / 技能清单          | Estate 层                                                                      |

---

## 存储与端口

- **表：** `self_blocks`（[`engine/db/src/schema/self-layer.ts`](../engine/db/src/schema/self-layer.ts)）
- **端口：** `SelfLayerStorePort`（`engine-repos`）→ `PgSelfLayerStore`（`connectors-db-pg`）
- **消费：** `@freeanima/life-self`（组装 prompt、工具 `get_self_blocks` / `update_self_block`）
- **装配：** `serve.ts` 调用 `registerSelfLayerStore` 并预热 `loadSelfLayerPrompt()` 缓存

`existence_anchor` 默认 `locked=true`；更新需工具参数 `force=true` 或 CLI 显式操作。

---

## 自传概括 vs 自传叙事

| 维度   | `autobiography_summary`（自我层）                  | `autobiographical_memory`（记忆层）                          |
| ------ | -------------------------------------------------- | ------------------------------------------------------------ |
| 问题   | 「我的生平主线概括是什么？」                       | 「某段经历对我意味着什么？」                                 |
| 形态   | 六块之一，Markdown 摘要                            | 独立表，title + content 叙事条目                             |
| 注入   | **常驻** system prompt                             | **不**常驻；按需 recall / 列表                               |
| 维护   | `builtin-self-autobiography` cron 从叙事表压缩写入 | 同一 cron 从 `semantic_memory`（experience/imprint）叙事加工 |
| 可变性 | 周期性覆盖 summary 块                              | **只追加**；仅 `deprecate` 软废弃                            |

详见 [`sleep.md`](sleep.md) §自传 cron。

---

## System Prompt 注入

组装顺序（[`life-memory/system-prompt`](../life/memory/src/system-prompt.ts) + [`system-prompt-wire`](../service/service/src/runtime/system-prompt-wire.ts)）：

````
1. 自我层（第二人称骨架 + ```md 内嵌六块）  ← loadSelfLayerPrompt() / self_blocks
2. 常驻记忆（第二人称骨架 + ```md 内嵌 pinned 事实）  ← semantic_memory
3. 项目上下文（```md 内嵌 session cwd 下 AGENTS.md）
````

各段标题（`## 自我层` / `## 常驻记忆` / `## 项目上下文`）在代码块外；正文在 `md` 围栏内。自我层与常驻记忆段外层使用第二人称指令骨架，内层保留第一人称自我陈述质地。

维护方式：`get_self_blocks` / `update_self_block` 工具，或直接写 PG `self_blocks`。

---

## 与记忆层的关系

| 维度 | 记忆层                               | 自我层                         |
| ---- | ------------------------------------ | ------------------------------ |
| 方向 | 向外——记录世界和经历                 | 向内——定义自我                 |
| 问题 | 「我知道什么？」                     | 「我是谁？」                   |
| 自传 | 详细叙事在 `autobiographical_memory` | 概括在 `autobiography_summary` |
| 注入 | pinned 事实 + recall 按需            | 六块全部常驻                   |

---

## 设计演进

```
v1（2026-05-30）  L1–L4 概念模型 + 叙事文件运行时注入（已废弃）
v2（2026-06-07）  PG self_blocks 六块 + autobiographical_memory 独立表 + 04:00 自传 cron
```

## 未解决问题

1. **跨实例迁移**——多个逸灵风实例时，自我层是否整体迁移？
2. **人格基线更新规则**——新证据与当前倾向冲突时，自动演化还是需确认？
3. **自传 recall 工具**——详细叙事按需检索的 API/工具形态
