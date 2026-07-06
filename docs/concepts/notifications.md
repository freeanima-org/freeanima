---
title: Notifications
---

# Notifications

PG-backed in-app inbox for **user** and **agent** subjects (entity model). Cron results, task due reminders, and LLM tools write here; Shell UI lists and marks read via SAP.

## Recipients

Configure subject entity ids in `config.yaml` **`worlds`** section (SSOT; legacy `notifications` still read as fallback):

```yaml
worlds:
  user_subject_id: 1 # type=user entity; default 1
  agent_subject_id: 2 # type=agent entity; default 2
```

`user_world_id` / `agent_world_id` are derived at Hub boot from each subject's `default_private_world_id` (see [`entity-model.md`](entity-model.md)).

Each row stores `recipient_kind` (`user` | `agent`) and `recipient_id` (entity id string). Unconfigured installs default to subject ids `1` / `2`.

| Writer                                  | Typical recipient                          |
| --------------------------------------- | ------------------------------------------ |
| Cron success (when `notify_on_success`) | **both** user + agent                      |
| Cron failure                            | **both** user + agent                      |
| Task due reminder                       | agent                                      |
| `notification_send` tool                | user / agent / both; optional `subject_id` |

Dream pipeline **does not** create notifications (reminder removed).

## Agent consciousness

Unread agent notifications are injected at inference time via a runtime-only **`assistant(name=notification_context)`** turn immediately before the last `user` message. They are **not** persisted in conversation messages.

The inject block includes a **Handling protocol** (three-way triage by whether action is needed — not by `source_kind`).

### Agent handling protocol

For each injected `[id:…]` line, classify by content (not by writer/source):

| Category                          | Action                          | Mark read                                       |
| --------------------------------- | ------------------------------- | ----------------------------------------------- |
| **Informational only**            | Acknowledge in reply if useful  | Batch `notification_mark_read({ ids: [...] })`  |
| **Action needed, quick**          | Handle within ~3 tool rounds    | `notification_mark_read` that id after done     |
| **Action needed, slow/uncertain** | Ask the user before a long task | Do **not** mark read until approved and handled |

Unmarked unread items are re-injected on the next user turn. Use `notification_list(recipient=agent, read_filter=unread)` if the inject block is truncated.

## LLM tools (ToolSet `notification`)

Load via `toolset_load` with `notification`.

| Tool                     | Scope parameter                                                          |
| ------------------------ | ------------------------------------------------------------------------ |
| `notification_send`      | Optional `subject_id` (overrides `target`); default `target=both`        |
| `notification_list`      | Optional `subject_id` (overrides `recipient`); default `recipient=agent` |
| `notification_mark_read` | Notification id only (global)                                            |

`subject_id` must be the configured `user_subject_id` or `agent_subject_id` from system prompt / `ResolvedWorldContext`.

## Task reminder scan

Builtin cron `builtin-task-reminders` runs **every minute** (`* * * * *`).

For each pending `task_item`:

1. **Trigger time**: `remind_at` if set, else `due_at`; if neither, skip.
2. **Send** when `trigger <= now` and `last_notified_at` is absent or `last_notified_at < trigger` (entity JSONB field on schedulable body).
3. **After send**: patch `last_notified_at` on the task entity; do not rely on day-based `source_ref` dedup alone.

**Product rule (confirmed)**: one trigger per task per scan — **remind first, else due**; not separate notifications for both when both are set.

Task reminders are delivered via this inbox (ToolSet `task` / cron), not by `notification_send` duplicating the same reminder.

## Tools

ToolSet `notification`:

- `notification_send`
- `notification_list`
- `notification_mark_read` — `id` or `ids` (batch, max 20)

Included in default conversation toolsets when registered.

## SAP (read)

- `notification.list` — requires `recipient_kind` + optional `recipient_id`
- `notification.markRead`
- `notification.recipients` — configured subject ids for UI tabs

No SAP create RPC in v1; writes are Hub-internal + tools.

## Related

- Entity subjects: [`entity-model.md`](entity-model.md)
