---
title: Session Goal
---

# Session Goal

Session Goal lets you set a persistent objective for a single conversation. After each turn, an independent **judge model** decides whether the goal is complete; if not, a continuation prompt is injected automatically until the goal is met, the turn budget is exhausted, or the user pauses/clears.

## Commands

| Command                | Description                                           |
| ---------------------- | ----------------------------------------------------- |
| `/goal <description>`  | Set goal and start first run (default 20-turn budget) |
| `/goal status`         | View goal, subgoals, turn count, judge reason         |
| `/goal pause`          | Pause auto-continuation (keep goal state)             |
| `/goal resume`         | Resume auto-continuation                              |
| `/goal clear`          | Clear goal                                            |
| `/subgoal`             | List subgoals                                         |
| `/subgoal <condition>` | Append sub-condition                                  |
| `/subgoal remove <N>`  | Remove subgoal N (1-based)                            |
| `/subgoal clear`       | Clear all subgoals                                    |

On **Chat**, terminal commands (`/goal status`, pause/resume/clear, `/subgoal` list, etc.) run via Habitat RPC `conversation.command` and show in a result panel or toast — they do not flash through the message stream. Setting a goal (`/goal <description>`) and `/retry` still use `message.send` so the LLM turn streams into the conversation. Discord/Weixin keep the existing slash → stream reply path.

## Workflow

1. User runs `/goal …` → writes `conversations.goal` and triggers engine run.
2. After each assistant reply → **goal judge** (`run_kind: goal-judge` AutoLlmRun; not written into conversation messages).
3. Judge outputs strict JSON: `{"done": boolean, "reason": "..."}`.
4. `done: false` → inject user-role continuation (e.g. `↻ Continuing toward goal (3/20): …`) into the **same conversation** `messages`, continue next turn in same SSE stream.
5. `done: true` → mark completed, stop continuation.
6. User message mid-run preempts current continuation; after that turn, re-judge; continues if not paused.

## Judge conservative policy

- **Pass**: assistant clearly confirms completion, shows final deliverable, or states blocker needing user input (reason explains).
- **Fail**: vague progress, plan only without evidence; implied completion does not count.
- **Judge unavailable**: call or parse failure **pauses** the goal (`status: paused`), logs a warn, and appends a visible status line to the conversation (not a continue prompt). Use `/goal resume` to retry. Check `/goal status` for `last_judge_reason`.

## Configuration

Optional `goal_judge` in Habitat runtime `llm.profiles` (Shell **Settings → Habitat 服务 → 服务配置**). Falls back to `llm.default_profile` when unset.

Judge calls use OpenAI-compatible `response_format: json_object`, `thinking: { type: "disabled" }`, and `tool_choice: "none"` (via `params.extra`), plus `maxOutputTokens: 2048`. Prefer a model/gateway that supports JSON mode; unsupported endpoints will fail the judge call and pause the goal.

## vs ACP

- **Goal**: in-conversation synchronous continuation loop; orchestrated by platform turn lifecycle.
- **ACP**: external agent async task; callback triggers separate turn on completion.

See [`architecture.md`](../product/architecture.md#session-goal).
