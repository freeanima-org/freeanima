---
name: acp-cursor
description: Orchestrate acp_cursor multi-turn interaction (Plan / Ask / Agent, clarify decisions, continue_session reuse)
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

### Research (code analysis)

1. `acp_cursor(prompt, mode=ask)` → read-only, returns analysis directly

### Hybrid (look then change)

1. `acp_cursor(prompt, mode=ask)` → research
2. Decide if changes are needed
3. If needed → `acp_cursor(prompt=change description, continue_session=true, mode=agent)`

## Notes

- `continue_session` automatically uses the Cursor session bound to the current Free Anima conversation; no manual `session_id` needed
- `new_session=true` forces a new session (old binding is replaced)
- Cursor todos (`update_todos`) are Cursor internal checkpoints, unrelated to the Free Anima task system
