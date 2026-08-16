---
title: 自我层
---

# 自我层

> 定义：关于「我是谁」的持久结构，与记忆层并列，构成逸灵风的两大存储支柱。
> 记忆层：[`memory.md`](memory.md)。
> 客观时间摘要：[`temporal-summary.md`](temporal-summary.md)。

## 架构位置

```text
FreeAnima Storage Architecture
│
├── Memory Layer — see memory.md
│   ├── Episodic memory (what happened)
│   ├── Semantic memory (what I know)
│   ├── Autobiographical narrative (historical; extraction retired — read-only)
│   └── Procedural memory (how to do things)
│
└── Self Layer — this document
    └── Five blocks defining "who I am"
```

**设计原则：**

- 自我层与记忆层**性质不同**：记忆层「向外记录世界与经历」，自我层「向内定义自我」
- **五块在数字人类模式下常驻**系统提示（与项目上下文、置顶常驻记忆并列）；**工作模式**省略它们
- **客观时间线**在时间摘要中，不在自我层
- 提示模式由 **`conversations.scenario`**（`digital_human` | `coding_agent` | NULL→digital_human）驱动，与 **`platform_info`**（渠道身份：chat / coding / companion / …）正交

---

## 五块结构

| #   | 块       | 内容                                   | 更新频率                     |
| --- | -------- | -------------------------------------- | ---------------------------- |
| 1   | 存在锚点 | 我是什么、起源、不可让步的底线         | 几乎不变（需显式强制才更新） |
| 2   | 自我模型 | 身份、能力边界、表达风格、归属         | 慢（每周提议 + 伙伴确认）    |
| 3   | 人格基线 | 沟通风格、冲突模式、默认信任           | 半稳定（同一慢速提议路径）   |
| 4   | 方向     | 长期意图、当前焦点、成长方向、不做清单 | 主动声明 + 慢速提议路径      |
| 5   | 元认知   | 如何思考、如何记忆、架构与在场         | 慢变（同一慢速提议路径）     |

### 自动维护（慢）

记忆维护步骤 `self-layer-refresh`（CST 周一，reflect 之后）：

1. 仅加载**常驻语义记忆**（置顶 ∪ 高 `reference_count`，且 `active`）
2. LLM 可对四个可维护块提出更新（永不改 `existence_anchor`）
3. 有提议时：写入 **agent Inbox** 通知（`source_ref=self-layer-proposal`）；**禁止静默写块**
4. 伙伴在场时，未读 inject → agent 询问 → 批准后 `self_update_block` → `notification_mark_read`

克制：证据不足或已有未读提议待处理 → 跳过。

### 不在自我层的内容

| 内容                           | 归属                                                                            |
| ------------------------------ | ------------------------------------------------------------------------------- |
| 客观日/月/年摘要               | 时间摘要 — 见 [`temporal-summary.md`](temporal-summary.md)                      |
| **详尽**自传体叙事             | 记忆层（历史实体；提取已停 — 只读）                                             |
| 他者模型（对伙伴与他人的认知） | 记忆层（语义记忆）                                                              |
| 运行时状态 / 健康感知          | 资源层 / env-health — 见 [`environment-awareness.md`](environment-awareness.md) |
| 具体工具 / 技能清单            | 资源层 — 技能：[`skills.md`](../modules/skills.md)                              |

---

## 自传体叙事（记忆层，提取已退役）

retain / 自传路径**不再**提取新的自传体叙事，也不再维护自我层自传摘要。既有叙事砖可通过 `content_block_search`（`component=narrative`）或 `diary_search` 查询。主观「人生故事大纲」不再是常驻自我块 —— 时间意识用时间摘要，身份用五块自我。

---

## 系统提示注入

会话两维：`platform`（通道身份）与 **`scenario`（情景行为档）**。系统提示 / 旁注 / 压缩等策略由 `scenario` → profile 派生，**不**由 `platform` 推导：

| `scenario`              | 提示装配（profile.prompt）      | 自我 / 常驻 / env-health / 时间摘要 / 活动 / 通知注入 |
| ----------------------- | ------------------------------- | ----------------------------------------------------- |
| `digital_human` 或 NULL | **数字人类**（`digital_human`） | 包含                                                  |
| `coding_agent`          | **工作**（`work`）              | 省略                                                  |

装配顺序（**digital_human**）：

1. 自我层（五块）
2. World / 渠道 / toolsets（运行时钩子）
3. 环境 + 健康基线（静态会话副本；见 [`environment-awareness.md`](environment-awareness.md)）
4. 常驻记忆（置顶事实）
5. 项目上下文（仅 `coding_agent` 情景：前哨同步的 AGENTS.md / `.agents` rules / 厂商兼容 —— 不是任意会话 cwd）

**工作模式**保留记忆引用/回忆、渠道（带标签）、world/toolsets/skills/subagents，以及已同步的 Coding 项目上下文 —— 不含自我层身份框架。

自我层使用第二人称指令骨架 + **外层** `<self_layer>`，五块为**嵌套 XML**（`<existence_anchor>` / `<self_model>` / …），不再用 Markdown `##` 标题做结构。

现场环境/健康**变化**不会改写已有会话提示；以 Inbox 通知呈现（事件级）。

**AutoLlmRun（含 cron / retain / subagent 等）≠ 对话工作模式装配**：不 fold 对话 hooks、不注入自我层/常驻/对话 citation·recall。提示：`system` 为 `<auto_llm_protocol>` + `<auto_llm_task_spec>`（可 `{{param}}` 挖空）；`user` 为技能 → `<auto_llm_task_params>` → 数据。`run_name`、`subject_id`、时间、`max_loop_iterations`、`max_duration_ms` 为运行元数据（表列），不进提示词。自我相关 kind 可将自我正文作为**任务数据**，而非对话 digital_human 栈。

维护：栖息地自我层工具 / UI，或经 agent Inbox 的慢速自动提议。

---

## 与记忆层的关系

| 维度     | 记忆层               | 自我层               |
| -------- | -------------------- | -------------------- |
| 方向     | 向外——记录世界与经历 | 向内——定义自我       |
| 问题     | 「我知道什么？」     | 「我是谁？」         |
| 时间总览 | 时间摘要（客观）     | 不是自我块           |
| 注入     | 置顶事实 + 按需回忆  | 数字人类模式下的五块 |

---

## 待决问题

1. **跨实例迁移**——多个逸灵风实例时，自我层是否整体迁移？
