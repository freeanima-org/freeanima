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

## Workflow

1. User runs `/goal …` → writes `conversations.goal` and triggers engine run.
2. After each assistant reply → **goal judge** reads goal, subgoals, recent dialogue, last reply.
3. Judge outputs strict JSON: `{"done": boolean, "reason": "..."}`.
4. `done: false` → inject user-role continuation (e.g. `↻ Continuing toward goal (3/20): …`), continue next turn in same SSE stream.
5. `done: true` → mark completed, stop continuation.
6. User message mid-run preempts current continuation; after that turn, re-judge; continues if not paused.

## Judge conservative policy

- **Pass**: assistant clearly confirms completion, shows final deliverable, or states blocker needing user input (reason explains).
- **Fail**: vague progress, plan only without evidence; implied completion does not count.
- **Fail-open**: judge call or parse failure treated as incomplete; turn budget prevents deadlock.

## Configuration

Optional `goal_judge` in `~/.anima/config.yaml` `llm.profiles` (see [`config.example.yaml`](../../config.example.yaml)). Falls back to `llm.default_profile` when unset.

## vs ACP

- **Goal**: in-conversation synchronous continuation loop; orchestrated by platform turn lifecycle.
- **ACP**: external agent async task; callback triggers separate turn on completion.

See [`architecture.md`](../concepts/architecture.md#session-goal).
