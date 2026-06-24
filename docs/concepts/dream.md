---
title: Dream
---

# Dream Mechanism

> Nightly creative narratives generated after light sleep; not factual memory.

## Overview

Dreaming is the digital life's **imaginative** counterpart to memory consolidation. It does not extract facts or update semantic inventory—it produces a surreal, first-person narrative from the day's emotional tone and random episodic fragments.

## Trigger

| Condition                                                            | Result                     |
| -------------------------------------------------------------------- | -------------------------- |
| No limbic memory with `intensity > 0.5` in the day's creation window | Skip (`no_strong_emotion`) |
| Dream already exists for that day                                    | Skip (`already_dreamed`)   |
| At least one strong limbic anchor produced that day                  | Generate dream             |

Trigger is **purely emotion-driven** (no random dice). Session activity is **not** required; episodic fragments may be empty.

## Input

1. **Emotional tone** — top 3 `limbic_memory` rows whose `created_at` falls in `[conversation day 00:00 CST, next day 06:00 CST)` (covers daytime writes and ~02:00 light-sleep extraction), where `intensity > 0.5`, ordered by intensity descending.
2. **Episodic fragments** — random sample of user/assistant messages from the day's sessions (conversation archive), capped ~4k chars; omitted when no sessions were updated that day.

Light sleep stage 2 must complete first so limbic anchors exist.

## Output

- Persisted in PG table `dream_memory` (one row per CST calendar day, unique `dream_day`).
- Append-only; content is not updated after creation.
- Redis fridge magnet `dream:reminder:{day}` (TTL 24h) with a short teaser when a dream is created.

## Orchestration

Sleep-cycle DAG node `dream`:

```text
light-sleep
  ├─► deep-sleep ──► memory-ref-sync
  ├─► dream        (parallel with deep-sleep / self-layer-refresh)
  └─► self-layer-refresh
```

LLM call uses `PROFILE_REFLECT` with elevated temperature (~1.1), **no tools**, single completion.

## Tools & UI

| Surface                        | Purpose                                                           |
| ------------------------------ | ----------------------------------------------------------------- |
| `dream_read` tool              | Read stored dream; auto-dismisses fridge reminder                 |
| `fridge_magnet_dismiss` tool   | Explicitly tear off any fridge magnet (including dream reminders) |
| Admin `/admin/dashboard/dream` | Browse dream history                                              |

## Design Notes

- Dreams are **not** injected into system prompt or resident memory.
- Accuracy is explicitly **not** a goal; association and metaphor are.
- When Redis is unavailable, dreams still persist in PG; reminders silently degrade.

See also: [`sleep.md`](sleep.md), [`memory.md`](memory.md).
