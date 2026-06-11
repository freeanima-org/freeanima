---
name: acp-cursor
description: Orchestrate acp_cursor multi-turn interaction (Plan / Ask / Agent, clarify decisions, continue_session reuse, async background tasks)
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

Resume the same Cursor session (answer questions, approve plans, continue execution):

```text
acp_cursor(prompt="...", continue_session=true, mode="agent")
```

## Async Background Tasks (default)

By default `acp_cursor` runs **asynchronously** — delegate long-running work without blocking the current turn:

```text
acp_cursor(prompt="...", mode="agent", context="project path")
```

Use blocking mode only when you need the full result in the same tool return:

```text
acp_cursor(prompt="...", mode="agent", async=false)
```

Returns immediately with `{ task_id, status: "started" }`. When the task finishes (or needs a decision), Free Anima:

1. Writes an **assistant message** (`[ACP result]` / `[ACP error]`) with full result JSON (`output`, `pending`)
2. Updates `session_meta.acp_tasks` (keyed by ACP session id)
3. Triggers a **callback turn** so you can review and respond

Cancel a running async task:

```text
acp_cursor(cancel="<task_id>")
```

`acp_tasks` entry shape:

```json
{
  "<acp_session_id>": {
    "status": "running | completed | awaiting_decision | cancelled | error",
    "task_id": "...",
    "agent_name": "cursor",
    "updated_at": "ISO8601",
    "pending": []
  }
}
```

Notes:

- One running async task per ACP agent at a time
- `timeout_minutes` defaults to 30 in async mode
- On callback turn, read the `[ACP result]` assistant message JSON and use `continue_session=true` to resume Cursor

## Blocking Interaction (pending)

When the returned JSON contains a `pending` field, Cursor is waiting for a decision:

### pending with questions

1. Read choices in `pending[].questions`
2. **Enough context** → choose an answer autonomously, send back as `prompt` with `continue_session=true`
3. **Need partner input** → use the `clarify` tool, then `continue_session=true` after reply

### pending with plan

1. Read the plan in `pending[].plan`
2. **Acceptable** → `continue_session=true, mode=agent`, prompt says "approved, please execute the plan"
3. **Needs changes or partner confirmation** → `clarify` or give revision notes directly in prompt

## Recommended Flows

### Execution (refactor, implement)

1. `acp_cursor(prompt, mode=plan)` → get plan, may have questions
2. Handle questions (autonomous or clarify)
3. `acp_cursor(prompt=approval/answers, continue_session=true, mode=agent)` → execute

### Long task (async)

1. `acp_cursor(prompt, mode=agent)` → get `task_id`, continue other work
2. On callback turn → read `[ACP result]` assistant message JSON
3. If `pending` present → answer or clarify, then `continue_session=true`
4. If completed → summarize for the user or take follow-up action

### Research (code analysis)

1. `acp_cursor(prompt, mode=ask)` → read-only, returns analysis directly

## Notes

- `continue_session` automatically uses the Cursor session bound to the current Free Anima conversation; no manual `session_id` needed
- `new_session=true` forces a new session (old binding is replaced)
- Cursor todos (`update_todos`) are Cursor internal checkpoints, unrelated to the Free Anima task system
