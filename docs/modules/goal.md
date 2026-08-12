---
title: 会话便签
---

# 会话便签

会话便签让你为单次对话设定持久目标。每轮结束后，独立的 **judge model（评判模型）**
判定目标是否完成；若未完成，则自动注入续写提示，直至目标达成、轮次预算耗尽，或用户暂停/清除。

## 命令

| 命令                   | 说明                                     |
| ---------------------- | ---------------------------------------- |
| `/goal <description>`  | 设定目标并启动首次运行（默认 20 轮预算） |
| `/goal status`         | 查看目标、子目标、轮次计数、评判理由     |
| `/goal pause`          | 暂停自动续写（保留目标状态）             |
| `/goal resume`         | 恢复自动续写                             |
| `/goal clear`          | 清除目标                                 |
| `/subgoal`             | 列出子目标                               |
| `/subgoal <condition>` | 追加子条件                               |
| `/subgoal remove <N>`  | 移除第 N 个子目标（从 1 起计）           |
| `/subgoal clear`       | 清除全部子目标                           |

在**聊天室**中，终端命令（`/goal status`、暂停/恢复/清除、`/subgoal` 列表等）经栖息地 RPC `conversation.command` 执行，结果在面板或 toast 展示 — 不闪过消息流。设定目标（`/goal <description>`）与 `/retry` 仍走 `message.send`，使 LLM 轮次流入对话。Discord/微信保持既有 slash → 流式回复路径。

## 工作流

1. 用户执行 `/goal …` → 写入 `conversations.goal` 并触发 engine 运行。
2. 每条助手回复后 → **goal judge**（`run_kind: goal-judge` AutoLlmRun；不写入对话消息）。
3. 评判输出严格 JSON：`{"done": boolean, "reason": "..."}`。
4. `done: false` → 向**同一对话** `messages` 注入 user 角色续写（如 `↻ Continuing toward goal (3/20): …`），在同一 SSE 流中继续下一轮。
5. `done: true` → 标记完成，停止续写。
6. 运行中用户消息会抢占当前续写；该轮结束后重新评判；未暂停则继续。

## 评判保守策略

- **通过**：助手明确确认完成、展示最终交付物，或说明需用户输入的阻塞（理由中说明）。
- **不通过**：进展模糊、仅有计划而无证据；隐含完成不算。
- **评判不可用**：调用或解析失败会**暂停**目标（`status: paused`），打 warn 日志，并向对话追加可见状态行（不是续写提示）。用 `/goal resume` 重试。用 `/goal status` 查看 `last_judge_reason`。

## 配置

可选在栖息地运行时 `llm.profiles` 中配置 `goal_judge`（壳 **设置 → 栖息地服务 → 服务配置**）。未设时回落到 `llm.default_profile`。

评判调用使用 OpenAI 兼容的 `response_format: json_object`、`thinking: { type: "disabled" }`，以及经 `params.extra` 的 `tool_choice: "none"`，外加 `maxOutputTokens: 2048`。优先选支持 JSON 模式的模型/网关；不支持的端点会使评判失败并暂停目标。

## vs 子代理

- **Goal**：对话内同步续写循环；由平台轮次生命周期编排。
- **Subagent**：经 `subagent_run` 的独立 AutoLlmRun；结果作为工具载荷返回（见 [`subagent.md`](./subagent.md)）。

见 [`architecture.md`](../product/architecture.md#session-goal)。
