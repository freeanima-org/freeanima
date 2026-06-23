---
title: Session Goal
---

# Session Goal（会话目标）

Session Goal 允许为单个会话设定持久目标。每轮对话结束后，独立的 **judge 模型**判定目标是否完成；未完成则自动注入续跑提示，驱动 agent 继续工作，直到目标达成、turn 预算耗尽、或被用户暂停/清除。

## 命令

| 命令                  | 说明                                         |
| --------------------- | -------------------------------------------- |
| `/goal <描述>`        | 设定目标并开始首轮执行（默认 20 turn 预算）  |
| `/goal status`        | 查看当前目标、子目标、turn 计数与 judge 理由 |
| `/goal pause`         | 暂停自动续跑（保留目标状态）                 |
| `/goal resume`        | 恢复自动续跑                                 |
| `/goal clear`         | 清除目标                                     |
| `/subgoal`            | 列出子目标                                   |
| `/subgoal <条件>`     | 追加子条件                                   |
| `/subgoal remove <N>` | 删除第 N 条子目标（1-based）                 |
| `/subgoal clear`      | 清空子目标                                   |

## 工作流程

1. 用户执行 `/goal …` → 写入 `sessions.goal` 并触发 engine run。
2. 每轮 assistant 回复结束 → **goal judge** 读取目标、子目标、最近对话与末轮回复。
3. Judge 输出严格 JSON：`{"done": boolean, "reason": "..."}`。
4. `done: false` → 注入 user-role 续跑消息（如 `↻ Continuing toward goal (3/20): …`），在同一 SSE 流内继续下一轮。
5. `done: true` → 标记 completed，停止续跑。
6. 用户中途发消息会 preempt 当前续跑；该轮结束后重新 judge，未 pause 则继续。

## Judge 保守策略

- **通过**：assistant 明确确认完成、清楚展示最终产出、或说明不可达成/需用户输入（reason 说明阻塞点）。
- **不通过**：模糊进展、仅有计划无证据、「暗示已完成」不算。
- **Fail-open**：judge 调用或解析失败时视为未完成，靠 turn 预算兜底，避免卡死。

## 配置

在 `~/.anima/config.yaml` 的 `llm.profiles` 中可选配置 `goal_judge`（见 [`config.example.yaml`](../../config.example.yaml)）。未配置时回退 `llm.default_profile`。

## 与 ACP 的区别

- **Goal**：同会话内同步续跑循环，由 platform turn 生命周期编排。
- **ACP**：外部 agent 异步任务，完成后通过 callback 触发独立 turn。

详见 [`architecture.md`](../concepts/architecture.md#session-goal).
