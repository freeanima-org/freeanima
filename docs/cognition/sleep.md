---
title: Sleep
---

# Sleep Mechanism

> Light Sleep is the incremental extraction channel (semantic + limbic + autobiographical); Deep Sleep optimizes semantic memory inventory.

## Overview

Sleep is the digital life's memory consolidation mechanism—analogous to human sleep where the brain replays daytime experiences, converts short-term memory to long-term storage; the consolidation process itself dissipates, leaving no trace.

## Design Principles

1. **Internal mechanism, no trace** — Sleep runs in background, does not write to conversations, does not affect conversation flow
2. **Do not copy human rhythm literally** — Triggered by system need (cron), not real-time
3. **Two-tier layering** — Light sleep (incremental writes), deep sleep (semantic inventory optimization)
4. **Identity context** — All memory processing must carry **self layer six blocks** + resident memory (see [`self-layer.md`](self-layer.md))

## Current State

| Mechanism              | Status         | Notes                                                                                                       |
| ---------------------- | -------------- | ----------------------------------------------------------------------------------------------------------- |
| Sleep cycle pipeline   | ✅ Implemented | In-process `Bun.cron` `builtin-sleep-cycle` @ 02:00 CST（不经 PG `cron_jobs`）                              |
| Session cleanup        | ✅ Implemented | Step `conversation-cleanup` before light-sleep in sleep-cycle DAG                                           |
| Light sleep (in-cycle) | ✅ Implemented | Step `light-sleep` in sleep-cycle DAG                                                                       |
| Deep sleep (in-cycle)  | ✅ Implemented | Step `deep-sleep`, depends on light-sleep                                                                   |
| Memory ref sync        | ✅ Implemented | Step `memory-ref-sync`, depends on deep-sleep                                                               |
| Self-layer refresh     | ✅ Implemented | Step `self-layer-refresh`, after light-sleep                                                                |
| Dream (in-cycle)       | ✅ Implemented | Step `dream`, depends on light-sleep; parallel with deep-sleep                                              |
| Temporal summary       | ✅ Implemented | Steps `temporal-summary-day` / `temporal-summary-cascade`; see [`temporal-summary.md`](temporal-summary.md) |

## Orchestration

Sleep uses a **macro DAG** (`sleep-cycle` pipeline) orchestrated by `PipelineRunner` (`@freeanima/host/engine/pipeline`). A single cron job triggers the full cycle; step order and dependencies are explicit in code ([`src/host/platform/boot/sleep-cycle.ts`](../../src/host/platform/boot/sleep-cycle.ts)).

**Light sleep** and **deep sleep** keep their **internal** multi-stage / multi-round sequencing inside `runLightSleep()` / `runDeepSleep()` — not promoted to macro DAG nodes.

Habitat (`/habitat`/dashboard/sleep`) supports **diagnostic** runs: full cycle or individual steps (`force` skips dependency checks). **Deep sleep mode** (full vs incremental) can be selected before manual runs.

**Pipeline step history** is persisted in PG `pipeline_step_run` (one row per node execution, including failures and manual retries via `attempt`). Sleep-cycle scheduling is **in-process `Bun.cron`** (not listed under Habitat → Cron / `cron_log`); diagnostics remain on the Sleep dashboard.

Pipeline run state is persisted at `~/.anima/runtime/pipeline_sleep-cycle_run.json` (SSOT for step status; no EventBus).

## Light Sleep

| Attribute     | Value                                                                                                                                                      |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Trigger       | Sleep-cycle step `light-sleep` (cron @ 02:00 or Habitat diagnostics)                                                                                       |
| Scope         | Sessions with `updated_at` in the previous CST calendar day (**excludes cron-platform sessions**)                                                          |
| Input         | **Messages whose timestamps fall in that same day window** (user+assistant, tools stripped), segmented by conversation — not the full conversation history |
| Empty day     | If a session was updated that day but has **no messages in the day window**, it is omitted from extraction                                                 |
| Orchestration | Three stages sequential (separate LLM calls each)                                                                                                          |

### Three Stages

| Stage              | Target                       | Purpose                                                                                  |
| ------------------ | ---------------------------- | ---------------------------------------------------------------------------------------- |
| 1 Semantic         | Semantic memory              | Extract facts, preferences, experiences from dialogue                                    |
| 2 Limbic           | Emotional anchors            | Capture conversation mood and emotional turning points                                   |
| 3 Autobiographical | Autobiographical narrative   | Record what experiences meant to the digital life                                        |
| 3b                 | Autobiography summary (self) | Compress narratives into grouped self-layer outline (title-only bullets by significance) |

**Restraint principle:** Each stage LLM may judge "nothing worth recording" → no writes; program still runs subsequent stages.

**Dedup (semantic):** Compare only against existing memories from same source sessions; cross-thread merging left to deep sleep.

**Dedup (limbic):** Soft restraint against existing limbic for the same sessions (queried by `conversation_id`); do not re-record similar feelings for the same session.

## Deep Sleep

| Attribute  | Value                                                                                                                                                 |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Trigger    | Sleep-cycle step `deep-sleep` (after light-sleep in DAG)                                                                                              |
| Target     | All active semantic memory                                                                                                                            |
| Operations | Contradiction detection + expiry marking, split, dedup merge, pin quality review—four sequential rounds                                               |
| Mode       | **Incremental** (scheduled Tue–Sun): skip quiet rounds when nothing was `updated` in 24h; **Full** (scheduled Mon + manual): all rounds on full store |

### Four Rounds

| Round | Intent                                                                  |
| ----- | ----------------------------------------------------------------------- |
| 1     | Contradiction detection + expiry marking                                |
| 2     | Split multi-fact entries                                                |
| 3     | Dedup merge similar entries                                             |
| 4     | Pin quality review (unpin stale pins; resident read still capped at 40) |

**Ordering rationale:** Clean problems first, then refine, then merge, then review pinned quality.

**Incremental skip rules:** When mode is incremental and no active memory has `updated` within the last 24 hours, rounds 1 and 3 are skipped. Round 2 runs only on pre-filtered split candidates (long/multi-sentence entries with recent `updated`). Round 4 (pin maintenance) always runs. Scheduled cron uses incremental Tue–Sun and **full on Mondays**; Habitat manual runs default to full but can select incremental.

### Contradiction Definition (Exclusive)

Two memories semantically negate each other and cannot be explained by temporal change → contradiction.

- ✓ Contradiction: "daughter born Year of Tiger" vs "daughter born Year of Goat"
- ✗ Not contradiction: "likes apples" vs "likes cherries" (can coexist)
- ✗ Not contradiction (change): "likes Python" vs "now prefers TypeScript"

## Trigger Mechanism

```cron
0 2 * * *  sleep-cycle   # in-process Bun.cron builtin-sleep-cycle: conversation-cleanup → light → deep ∥ dream ∥ self-layer-refresh → memory-ref-sync
```

DAG (macro layer):

```text
conversation-cleanup
  └─► light-sleep
        ├─► deep-sleep ──► memory-ref-sync
        │              └─► temporal-summary-cascade
        ├─► dream
        ├─► self-layer-refresh
        └─► temporal-summary-day
```

### Session cleanup (pre-light-sleep)

Runs as the first sleep-cycle step before light-sleep scans yesterday's sessions.

| Rule                                         | Action                        |
| -------------------------------------------- | ----------------------------- |
| `messages` count = 0                         | Delete when stale             |
| `messages` count = 1 (any role)              | Delete when stale             |
| `messages` count > 1 and no `assistant` role | Delete when stale             |
| Has `assistant` and ≥2 messages              | Keep                          |
| `debug = true`                               | Keep (separate debug cleanup) |

**Stale** means `conversations.updated_at` older than **24 hours** (wall-clock `timestamptz`, not CST day boundary). Recent empty sessions (e.g. satellite "new conversation" without a first message) are kept until the next night's run.

After downtime, the next scheduled run catches up.

**Compression** stays session-scoped (turn-time `advanceCompressionMeta`); it is **not** a sleep-cycle step. Nightly consolidation does not replace per-conversation compression.

## Historical Day (Habitat)

For a single past CST calendar day (e.g. before go-live or after migration), use **Habitat → Sleep** (`/habitat`/dashboard/sleep`):

1. Set **Day** to `YYYY-MM-DD`
2. Run the **light-sleep** step (check **Force** to skip dependency checks if needed)

Each step run is logged in the **Pipeline history** table on the sleep page (`pipeline_step_run.output`; deep-sleep rows include per-round summaries and change-log snapshots). Cross-session merge for that day still relies on a subsequent **deep-sleep** run. Cron-triggered cycle runs appear in **Habitat → Cron → Run history** on the sleep-cycle task.

## Relationship to Existing Architecture

```text
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
