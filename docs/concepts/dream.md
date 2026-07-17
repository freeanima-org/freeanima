---
title: Dream
---

# Dream Mechanism

> Nightly creative narratives generated after light sleep; not factual memory.
> Persisted as a **`content_block`** with semantic component **`dream`**, parented to the agent world's dated **`diary_entry`**.

## Overview

Dreaming is the digital life's **imaginative** counterpart to memory consolidation. It does not extract facts or update semantic inventory—it produces a surreal, first-person narrative from the day's emotional tone and random episodic fragments.

## Trigger

| Condition                                                           | Result                     |
| ------------------------------------------------------------------- | -------------------------- |
| No limbic brick with `intensity > 0.5` in the day's creation window | Skip (`no_strong_emotion`) |
| Dream block already exists for that day's diary                     | Skip (`already_dreamed`)   |
| At least one strong limbic anchor produced that day                 | Generate dream             |

Trigger is **purely emotion-driven** (no random dice). Session activity is **not** required; episodic fragments may be empty.

## Input

1. **Emotional tone** — top 3 limbic `content_block`s whose `created_at` falls in `[conversation day 00:00 CST, next day 06:00 CST)` where `intensity > 0.5`.
2. **Episodic fragments** — random sample of user/assistant messages from the day's sessions, capped ~4k chars.

Light sleep stage 2 must complete first so limbic anchors exist.

## Output

- Ensure agent default private world diary for CST `dream_day` (create empty shell if missing).
- Insert `content_block` (`block_type: text`) with components `content_block` + `dream`.
- Append-only; content is not updated after creation.
- Does **not** create notification inbox entries.

Legacy `dream_memory` / `dream_entry` rows are backfilled and removed in Drizzle migration `20260717180000_memory_bricks_to_diary`.

## Orchestration

Sleep-cycle DAG node `dream` (unchanged topology):

```text
light-sleep
  ├─► deep-sleep ──► memory-ref-sync
  ├─► dream        (parallel)
  └─► self-layer-refresh
```

## Tools & UI

| Surface                                                | Purpose                                     |
| ------------------------------------------------------ | ------------------------------------------- |
| `diary_get` / `content_block_list` (`component=dream`) | Read dream narrative                        |
| Shell `/diary`                                         | Browse dream blocks labeled「梦境」（只读） |

No independent `/dream` Shell module or `dream` ToolSet.

## Design Notes

- Dreams are **not** injected into system prompt or resident memory.
- Accuracy is explicitly **not** a goal; association and metaphor are.

See also: [`sleep.md`](sleep.md), [`memory.md`](memory.md), [`entity-model.md`](entity-model.md).
