---
name: acp-cursor
description: Orchestrate acp_cursor multi-turn interaction (Plan / Ask / Agent, clarify decisions, acp_conversation_id reuse, async background tasks)
created: 2026-06-06
---

# ACP Cursor Orchestration

Multi-turn workflow guide when delegating to the Cursor coding agent via `acp_cursor`.

## Mode Selection

| mode    | Purpose                                 | Examples                                                  |
| ------- | --------------------------------------- | --------------------------------------------------------- |
| `ask`   | Read-only analysis, no file edits       | "What does this code mean?" "Debug the cause of this bug" |
| `plan`  | Plan first, wait for approval           | "Redesign the API layer" "Large-scale refactor plan"      |
| `agent` | Direct code edits and command execution | "Implement this function" "Fix the tests"                 |

## Basic Usage

```text
acp_cursor(prompt="...", mode="agent", context="project path and constraints")
```

Resume the same Cursor conversation (answer questions, approve plans, continue execution):

```text
acp_cursor(prompt="...", acp_conversation_id="<from prior result>", mode="agent")
```

The `acp_conversation_id` comes from `[ACP result]` JSON or blocking tool return.

## Async Background Tasks (default)

By default `acp_cursor` runs **asynchronously** — delegate long-running work without blocking the current turn:

```text
acp_cursor(prompt="...", mode="agent", context="project path")
```

Use blocking mode only when you need the full result in the same tool return:

```text
acp_cursor(prompt="...", mode="agent", async=false)
```

Returns immediately with `{ task_id, status: "started" | "queued" }`. When the task finishes (or needs a decision), Free Anima:

1. Writes an **assistant message** (`[ACP result]` / `[ACP error]`) with full result JSON (`output`, `pending`, `acp_conversation_id`)
2. Updates `conversation_meta.acp_tasks` (keyed by ACP conversation id)
3. Triggers a **callback turn** so you can review and respond

Cancel a running or queued async task:

```text
acp_cursor(cancel="<task_id>")
```

Query task status (single or all active):

```text
acp_task_status()
acp_task_status(task_id="...")
acp_task_status(list_all=true)
```

`acp_tasks` entry shape:

```json
{
  "<acp_conversation_id>": {
    "status": "queued | running | completed | awaiting_decision | cancelled | error",
    "task_id": "...",
    "agent_name": "cursor",
    "updated_at": "ISO8601",
    "pending": []
  }
}
```

Notes:

- **Omit `acp_conversation_id` to start a new Cursor session** (async and sync)
- **Pass `acp_conversation_id` to continue an existing Cursor session**
- Multiple async tasks may run in parallel per agent (`max_concurrent_tasks`, default 3); excess tasks are FIFO queued
- `timeout_minutes` defaults to 30 in async mode
- On callback turn, read `[ACP result]` JSON and use its `acp_conversation_id` to resume

## Blocking Interaction (pending)

When the returned JSON contains a `pending` field, Cursor is waiting for a decision:

### pending with questions

1. Read choices in `pending[].questions`
2. **Enough context** → choose an answer autonomously, send back as `prompt` with `acp_conversation_id`
3. **Need partner input** → use the `clarify` tool, then `acp_conversation_id` after reply

### pending with plan

1. Read the plan in `pending[].plan`
2. **Acceptable** → `acp_conversation_id=<same>, mode=agent`, prompt says "approved, please execute the plan"
3. **Needs changes or partner confirmation** → `clarify` or give revision notes directly in prompt

## Recommended Flows

### Execution (refactor, implement)

1. `acp_cursor(prompt, mode=plan)` → get plan, may have questions
2. Handle questions (autonomous or clarify)
3. `acp_cursor(prompt=approval/answers, acp_conversation_id=<id>, mode=agent)` → execute

### Long task (async)

1. `acp_cursor(prompt, mode=agent)` → get `task_id`, continue other work
2. On callback turn → read `[ACP result]` assistant message JSON
3. If `pending` present → answer or clarify, then `acp_conversation_id=<id from result>`
4. If completed → summarize for the user or take follow-up action

### Parallel long tasks

1. Launch multiple `acp_cursor(prompt, mode=agent)` — each gets its own ACP session
2. Monitor with `acp_task_status(list_all=true)` or Console ACP dock
3. Handle each callback / `[ACP result]` independently; reuse via each result's `acp_conversation_id`

### Research (code analysis)

1. `acp_cursor(prompt, mode=ask)` → read-only, returns analysis directly

## Notes

- `new_session=true` forces a new conversation and replaces the previous binding for that agent in meta
- Cursor todos (`update_todos`) are Cursor internal checkpoints, unrelated to the Free Anima task system
