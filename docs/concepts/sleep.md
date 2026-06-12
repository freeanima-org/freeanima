---
title: Sleep
---

# Sleep Mechanism

> Light Sleep is the incremental extraction channel (semantic + limbic + autobiographical); Deep Sleep optimizes semantic memory inventory.

## Overview

Sleep is the digital life's memory consolidation mechanism—analogous to human sleep where the brain replays daytime experiences, converts short-term memory to long-term storage; the consolidation process itself dissipates, leaving no trace.

## Design Principles

1. **Internal mechanism, no trace** — Sleep runs in background, does not write to sessions, does not affect conversation flow
2. **Do not copy human rhythm literally** — Triggered by system need (cron), not real-time
3. **Two-tier layering** — Light sleep (incremental writes), deep sleep (semantic inventory optimization)
4. **Identity context** — All memory processing must carry **self layer six blocks** + resident memory (see [`self-layer.md`](self-layer.md))

## Current State

| Mechanism        | Status         | Notes       |
| ---------------- | -------------- | ----------- |
| Light sleep cron | ✅ Implemented | Daily 02:00 |
| Deep sleep cron  | ✅ Implemented | Daily 03:00 |

## Light Sleep

| Attribute     | Value                                                                           |
| ------------- | ------------------------------------------------------------------------------- |
| Trigger       | Cron only, daily 02:00, no manual trigger                                       |
| Scope         | Sessions with activity in previous calendar day                                 |
| Input         | Full day's conversations (user+assistant, tools stripped), segmented by session |
| Orchestration | Three stages sequential (separate LLM calls each)                               |

### Three Stages

| Stage              | Target                       | Purpose                                               |
| ------------------ | ---------------------------- | ----------------------------------------------------- |
| 1 Semantic         | Semantic memory              | Extract facts, preferences, experiences from dialogue |
| 2 Limbic           | Emotional anchors            | Capture session mood and emotional turning points     |
| 3 Autobiographical | Autobiographical narrative   | Record what experiences meant to the digital life     |
| 3b                 | Autobiography summary (self) | Compress narratives into self-layer summary block     |

**Restraint principle:** Each stage LLM may judge "nothing worth recording" → no writes; program still runs subsequent stages.

**Dedup (semantic):** Compare only against existing memories from same source sessions; cross-thread merging left to deep sleep.

## Deep Sleep

| Attribute  | Value                                                                                                |
| ---------- | ---------------------------------------------------------------------------------------------------- |
| Trigger    | Cron only, daily 03:00, no manual trigger                                                            |
| Target     | All active semantic memory                                                                           |
| Operations | Contradiction detection + expiry marking, split, dedup merge, pin maintenance—four sequential rounds |

### Four Rounds

| Round | Intent                                   |
| ----- | ---------------------------------------- |
| 1     | Contradiction detection + expiry marking |
| 2     | Split multi-fact entries                 |
| 3     | Dedup merge similar entries              |
| 4     | Pin maintenance (keep pinned ≤ 20)       |

**Ordering rationale:** Clean problems first, then refine, then merge, then trim resident pins.

### Contradiction Definition (Exclusive)

Two memories semantically negate each other and cannot be explained by temporal change → contradiction.

- ✓ Contradiction: "daughter born Year of Tiger" vs "daughter born Year of Goat"
- ✗ Not contradiction: "likes apples" vs "likes cherries" (can coexist)
- ✗ Not contradiction (change): "likes Python" vs "now prefers TypeScript"

## Trigger Mechanism

```cron
0 2 * * *  light-sleep           # semantic + limbic + autobiographical
0 3 * * *  deep-sleep            # semantic maintenance
30 5 * * *  memory-reference-sync
```

After downtime, next scheduled run catches up.

## Historical Backfill (One-Time CLI)

For historical conversations before go-live or after migration:

```bash
anima memory sleep backfill [--from YYYY-MM-DD] [--to YYYY-MM-DD] [--resume]
```

| Option     | Description                                                          |
| ---------- | -------------------------------------------------------------------- |
| `--from`   | Start date; if omitted, earliest session day in archive              |
| `--to`     | End date; if omitted, **yesterday** (same as 02:00 cron default day) |
| `--resume` | Continue from progress file, skip completed days                     |

**Behavior notes:**

- Each day independently processed; single-day failure recorded then continue
- Autobiography summary refresh runs on **last day** by default
- Backfill writes semantic / limbic / autobiographical; **cross-session merge still relies on deep sleep**
- No conflict with 02:00 cron, but pause service during early-morning backfill if possible

## Relationship to Existing Architecture

```
Conversation archive
  │ light sleep cron (02:00, three stages)
  ├─► semantic memory
  ├─► emotional anchors
  └─► autobiographical narrative ──compress──► self-layer autobiography summary
  │
  │ deep sleep cron (03:00)
  ▼
semantic memory (consolidated)
  │ memory_recall (real-time retrieval in conversation)
  ▼
Agent identity and recalled fragments in current context
```

## `memory_remember` Tool

In-conversation `memory_remember` is a convenience wrapper for creating semantic memory during dialogue. Soft deprecation via deprecate action; physical delete also supported.
