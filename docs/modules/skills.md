---
title: 技能
---

# 技能

数字生命的程序性剧本：**ToolSet 是手；技能是招式。**

## 渐进披露

与 [Agent Skills](https://agentskills.io/specification) / OpenClaw / Hermes / Pi 对齐：

1. **目录（Catalog）** — `name` + 简短 `description` 写入系统提示（体量大时做预算 / 压缩）
2. **正文（Body）** — 完整 Markdown 说明经 `skill_load` 加载（**不**内联进系统提示）
3. **资源（Resources）** — 可选伴随实体（`skill_resource` / `object_file`）；按需加载

**不要**把每个技能正文都塞进系统提示。

## 存储

- **一个技能 = 一个实体**（`primary_component = skill`）
- 双层 World：**Commons**（`world_config.common`）放共享 / 内置技能；**agent private** 放用户 / 演化技能
- 目录解析：`commons ∪ agent_private`，同名时 **private 覆盖 commons**
- `title` = 名称，`summary` = 描述，`content` = 指令正文
- **不是**对象存储；**不是** `~/.anima/skills` 下的运行时文件树（Markdown+YAML 仅用于 **导入 / 导出**）

### agentskills.io 映射

| agentskills                         | FreeAnima                                                          |
| ----------------------------------- | ------------------------------------------------------------------ |
| `name`                              | `entities.title`（校验：小写、数字、连字符）                       |
| `description`                       | `entities.summary`                                                 |
| 正文 Markdown                       | `entities.content`                                                 |
| `license`                           | `skill.license`                                                    |
| `compatibility`                     | `skill.compatibility`（环境自然语言；≠ 工具列表）                  |
| `allowed-tools`（空格分隔）         | `skill.allowed_tools[]`（亦接受数组 / `@ToolSet`）                 |
| `metadata`                          | `skill.metadata`（导出时另加 `freeanima.*`）                       |
| `scripts` / `references` / `assets` | 伴随 `skill_resource` 或 `object_file`，引用写在 `skill.resources` |
| —                                   | `denied_tools`、`origin`、`status`（FreeAnima 扩展）               |

## 能力策略（工具）

技能参与 **能力策略（Capability Policy）** — 见 [`architecture.md`](../product/architecture.md)。

| 主体                         | `allowed_tools` | `denied_tools` |
| ---------------------------- | --------------- | -------------- |
| 技能                         | 主用            | 可选 / 少用    |
| 调用方（cron、睡眠、子代理） | 可选            | 主用           |

**可见聊天：** 默认 ToolSet（含 `skill`）；用户在场。  
**不可见运行：** 最小权限 — 默认拒绝全部工具；有效集合 ≈ 已加载技能的 allow 并集，再减去调用方 deny。无技能（且调用方未 allow）⇒ 无工具。

同伞下的 **数据** allow/deny **预留**（尚未实现）。

## 栖息地 UI

栖息地管理台：只读 **技能列表 + 详情**（`skill.list` / `skill.get`）。

## 自我演化（#46）

学习是一条 **旁路（bypass）**，不是主聊天回合。在门控通过的用户回合之后（或显式命令），栖息地跑一次短时 **`runAutoLlm`**，**仅**开放 `skill_*` 工具。运行记入 `auto_llm_runs`（`run_kind`：`skill-evolve` / `skill-maintain`），**不会**追加对话消息，也**不会**进入浅睡。

### 元技能 `skill-curation`

普通内置技能（commons）。旁路会把其正文 **硬注入** 评审系统提示。主聊天目录仍只展示名称 + 描述，除非 agent `skill_load` 它。

### Evolve 与 Maintain

|      | Evolve                                                             | Maintain                             |
| ---- | ------------------------------------------------------------------ | ------------------------------------ |
| 问题 | 这一回合是否产出了可复用的流程？                                   | 技能库是否健康？                     |
| 触发 | 回合后门控（≥N 次工具调用、skill_load+报错、报错后恢复、`/learn`） | `/skills curate`（后续可加周期钩子） |
| 输入 | 回合摘要 + 目录                                                    | 目录；工具按需拉取正文               |

共用：同一元技能、同一套 `skill_*` 工具、同一 `llm.profiles.skill_review`（回退到 default）、较小的 `maxTurns`。

### 写入路径（无需人工审批）

| 动作 | 工具                                                          |
| ---- | ------------------------------------------------------------- |
| 创建 | `skill_create`（`origin=user` \| `evolved`；status=`active`） |
| 补丁 | `skill_patch`（`old_string` / `new_string`）                  |
| 大改 | `skill_update`                                                |
| 删除 | `skill_delete`（非 builtin）                                  |

若本回合已写入技能，门控跳过 evolve（避免双重写入）。宁可 **noop**，不要产出低价值技能。

### 命令

| 命令             | 效果                         |
| ---------------- | ---------------------------- |
| `/learn [note]`  | 强制对当前对话走 evolve 旁路 |
| `/skills curate` | Maintain 旁路                |

### 本切片范围外

- 工具自我演化 / 运行时 ToolSet 注册
- 草稿 → 人工审批门控
- 在评审循环中开放非 `skill_*` 工具

## 非目标

- 技能的多智能体分发
- 技能膨胀治理（maintain 旁路之外）
- 运行时数据侧能力策略
- 恢复 Mask 预设 / `masks.yaml`
