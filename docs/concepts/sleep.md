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

| Mechanism              | Status         | Notes                                                          |
| ---------------------- | -------------- | -------------------------------------------------------------- |
| Sleep cycle pipeline   | ✅ Implemented | Single cron `builtin-sleep-cycle` @ 02:00                      |
| Light sleep (in-cycle) | ✅ Implemented | Step `light-sleep` in sleep-cycle DAG                          |
| Deep sleep (in-cycle)  | ✅ Implemented | Step `deep-sleep`, depends on light-sleep                      |
| Memory ref sync        | ✅ Implemented | Step `memory-ref-sync`, depends on deep-sleep                  |
| Self-layer refresh     | ✅ Implemented | Step `self-layer-refresh`, after light-sleep                   |
| Dream (in-cycle)       | ✅ Implemented | Step `dream`, depends on light-sleep; parallel with deep-sleep |

## Orchestration

Sleep uses a **macro DAG** (`sleep-cycle` pipeline) orchestrated by `PipelineRunner` (`@freeanima/runtime/pipeline`). A single cron job triggers the full cycle; step order and dependencies are explicit in code ([`platform/src/boot/sleep-cycle.ts`](../../platform/src/boot/sleep-cycle.ts)).

**Light sleep** and **deep sleep** keep their **internal** multi-stage / multi-round sequencing inside `runLightSleep()` / `runDeepSleep()` — not promoted to macro DAG nodes.

Chamber WebUI (`/webui/chamber/sleep`) supports **diagnostic** runs: full cycle or individual steps (`force` skips dependency checks).

Pipeline run state is persisted at `~/.anima/runtime/pipeline_sleep-cycle_run.json` (SSOT for step status; no EventBus).

## Light Sleep

| Attribute     | Value                                                                           |
| ------------- | ------------------------------------------------------------------------------- |
| Trigger       | Sleep-cycle step `light-sleep` (cron @ 02:00 or Chamber diagnostics)            |
| Scope         | Sessions with activity in previous calendar day                                 |
| Input         | Full day's conversations (user+assistant, tools stripped), segmented by session |
| Orchestration | Three stages sequential (separate LLM calls each)                               |

### Three Stages

| Stage              | Target                       | Purpose                                                                                  |
| ------------------ | ---------------------------- | ---------------------------------------------------------------------------------------- |
| 1 Semantic         | Semantic memory              | Extract facts, preferences, experiences from dialogue                                    |
| 2 Limbic           | Emotional anchors            | Capture session mood and emotional turning points                                        |
| 3 Autobiographical | Autobiographical narrative   | Record what experiences meant to the digital life                                        |
| 3b                 | Autobiography summary (self) | Compress narratives into grouped self-layer outline (title-only bullets by significance) |

**Restraint principle:** Each stage LLM may judge "nothing worth recording" → no writes; program still runs subsequent stages.

**Dedup (semantic):** Compare only against existing memories from same source sessions; cross-thread merging left to deep sleep.

## Deep Sleep

| Attribute  | Value                                                                                                |
| ---------- | ---------------------------------------------------------------------------------------------------- |
| Trigger    | Sleep-cycle step `deep-sleep` (after light-sleep in DAG)                                             |
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
0 2 * * *  sleep-cycle   # builtin-sleep-cycle: light → deep ∥ dream ∥ self-layer-refresh → memory-ref-sync
```

DAG (macro layer):

```
light-sleep
  ├─► deep-sleep ──► memory-ref-sync (optional step)
  ├─► dream (optional step)
  └─► self-layer-refresh (optional step)
```

After downtime, the next scheduled run catches up.

**Compression** stays session-scoped (turn-time `advanceCompressionMeta`); it is **not** a sleep-cycle step. Nightly consolidation does not replace per-session compression.

## Historical Day (Chamber WebUI)

For a single past CST calendar day (e.g. before go-live or after migration), use **Chamber → Sleep** (`/webui/chamber/sleep`):

1. Set **Day** to `YYYY-MM-DD`
2. Run the **light-sleep** step (check **Force** to skip dependency checks if needed)

Each run is logged in the run history table. Cross-session merge for that day still relies on a subsequent **deep-sleep** run.

## Relationship to Existing Architecture

```
Conversation archive
  │ sleep-cycle pipeline (02:00)
  │   step light-sleep (three internal stages)
  ├─► semantic memory
  ├─► emotional anchors
  └─► autobiographical narrative ──compress──► self-layer autobiography summary (grouped outline)
  │
  │   step deep-sleep (four internal rounds)
  ▼
semantic memory (consolidated)
  │   step memory-ref-sync
  │ memory_recall (real-time retrieval in conversation)
  ▼
Agent identity and recalled fragments in current context
```

## `memory_remember` Tool

In-conversation `memory_remember` is a convenience wrapper for creating semantic memory during dialogue. Soft deprecation via deprecate action; physical delete also supported.
