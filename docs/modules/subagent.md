---
title: 子代理
---

# 子代理（进程内）

具名子代理配置存为 `entities`（`primary_component = subagent`）。父对话经 ToolSet **`subagent`** 管理配置并派发工作。

## 执行路径

- `subagent_run` → `runAutoLlm({ runKind: "subagent" })`
- 全新消息上下文；**最终**结果仅为工具返回值（不写入父 `messages`，不进 retain 输入）。**父回合**仍等待工具完成后再进行下一跳 LLM（下一引擎轮）。
- 运行中，紧凑 `steps[]`（`name` / `title` / `status`）经 engine `tool_progress` → `tool_round_live` 投影到父聊天室工具条（同一 `tool_call_id`；状态保持 `running`）。**子 AutoLlm 运行**仍不写入父 `messages`。
- 返回载荷可含相同紧凑 `steps[]`，供父聊天室多级展开
- `depth=1`：子运行 HARD_DENY 全部 `subagent_*` 工具

## 具名 vs 临时

|          | **具名**                               | **临时**                                           |
| -------- | -------------------------------------- | -------------------------------------------------- |
| 身份     | `slug` 或 `id`（实体）                 | 两者皆省略                                         |
| 角色提示 | 实体 `content`（预配置）               | 调用 `instructions`（父 LLM 每次填写）             |
| 工具上限 | 实体 `allowed_tools`（不可经调用放大） | 调用 **`allowed_tools` 必填**（数组；空 = 无工具） |
| `title`  | 可选覆盖 AutoLlm `run_name`            | 强烈建议；回退 title / `ephemeral`                 |
| 技能     | 实体 + 调用并集                        | 仅调用 `skills`                                    |

## 工具策略（严格物化）

1. 配置 `allowed_tools` 是**唯一上限**（空 = 无工具；可含 `@ToolSet`）
2. 配置 / 技能 / 调用方 `denied_tools` 合并为拒绝；**拒绝优先**
3. HARD_DENY：`toolset_load`、`toolset_unload`、`toolset_search`，以及全部 `subagent_*`
4. 解析集**物化为具体工具名**作为 LLM `tools`，外加冻结的 `executableTools`
5. 技能：`prependSkillsToPrompt` 注入正文；技能 deny 可收窄；**技能 allow 不能放大**上限

## 派发

- 单任务用顶层 `goal`（不要包进 `tasks`）；`tasks[]` 仅并行（`auto_llm.subagent.max_parallel`，默认 4）。二者互斥。
- `max_loop_iterations`：调用 > 配置 > `auto_llm.subagent.max_loop_iterations`（默认 20）
- `temperature_tier`：调用 > 档案 > `auto_llm.subagent.temperature_tier` > `balanced`

## 采样档位（`temperature_tier`）

产品枚举三档（不暴露裸温度数值）：

| 枚举       | UI           | 相对比例（temperature / topP） |
| ---------- | ------------ | ------------------------------ |
| `focused`  | 专注         | 0.2 / 0.8                      |
| `balanced` | 平衡（默认） | 0.6 / 0.9                      |
| `creative` | 发散         | 1.0 / 0.95                     |

绝对值 = 比例落在模型采样区间。**默认区间** temperature/topP 皆 `[0, 1]`；模型族可微调（例如原生 OpenAI 族 temperature → `[0, 2]`；Claude / `anthropic_messages` 保持默认）。经 compatible 转发的 Claude 仍按 Claude 处理，不扩到 2。

## 子 system prompt 路径（非对话）

默认**最小**（无自我 / 常驻 / 环境健康 / 目录 / 通道）：

1. `system`：共用 AutoLlm 协议 + `SUBAGENT_TASK_SPEC`（收尾为给父代理的完整答复；`{{slug}}` 挖空）
2. `user`：可选技能 → `task_params`（slug）→ `<subagent_role>`（具名 `content` / 临时 `instructions` + `prompt_includes`）→ `<subagent_goal>`（本次 `goal` + 可选 `context`）
3. `prompt_includes`：`self` \| `world` \| `time` — 实体 body + 调用参数的**并集**；默认无。goal **不**进 `task_spec`

对话 prompt 段以 `llm_kind: conversation` 注册，不进子运行。

## 内置配置

栖息地启动时**确保** Agent 私有 World（按 slug 幂等；已有行不覆盖）：

| slug       | 角色                                                      |
| ---------- | --------------------------------------------------------- |
| `general`  | 通用本地工具                                              |
| `explorer` | 只读探索（记忆 / 文件 / 文档 / web）                      |
| `research` | 调研 — 结构化研究（`research` 技能 + web/browser/memory） |

## 父目录

可见聊天注入简短多步指引（子代理 → 技能 → toolsets），再在技能**之前**注入 **Subagents** 段（`slug` + 摘要）（`llm_kind: conversation`）。用 `subagent_run` 派发。单任务用 `goal`（不要用 `tasks` 包一层）；临时必须 `instructions`（角色）+ `goal` + `allowed_tools`。子运行 user 层拆 `<subagent_role>` 与 `<subagent_goal>`。

## 栖息地 UI

`/subagents`：列表 / 创建 / 编辑 allow-deny、技能、`prompt_includes`、采样档位。审计：AutoLlmRuns（`run_kind=subagent`）；`run_name` 来自调用 `title`。

## 与 ACP 对比

ACP 已移除。任务级委派即本模块；外部协议工具仍走 MCP。
