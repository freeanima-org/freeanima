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
3. **Two-tier layering** — Light sleep (incremental writes: semantic / limbic / autobiographical), deep sleep (semantic inventory optimization) each with its role
4. **Identity context** — All memory processing must carry **self layer six blocks** + resident memory (see [`self-layer.md`](self-layer.md))

## Current State

| Mechanism        | Status         | Notes                              |
| ---------------- | -------------- | ---------------------------------- |
| Light sleep cron | ✅ Implemented | Daily 02:00, `builtin-light-sleep` |
| Deep sleep cron  | ✅ Implemented | Daily 03:00, `builtin-deep-sleep`  |

## Light Sleep

| Attribute     | Value                                                                                                                          |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Trigger       | Cron only, daily 02:00 (`0 2 * * *`), no manual trigger                                                                        |
| Scope         | Sessions with activity in previous CST calendar day (`sessions.updated_at`)                                                    |
| Input         | Full day's conversations (user+assistant, tools stripped), segmented by session                                                |
| Orchestration | Three stages sequential (peer stages, separate LLM calls each; zero tool calls in prior stage does not skip subsequent stages) |

### Three Stages

| Stage              | Target storage                      | Tool allowlist                                    | Input highlights                                                         |
| ------------------ | ----------------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------ |
| 1 Semantic         | `semantic_memory`                   | `memory_semantic_create` / `update` / `deprecate` | Conversation + existing semantic (`listBySourceSessions`)                |
| 2 Limbic           | `limbic_memory`                     | `memory_limbic_create`                            | Conversation + existing limbic (`listBySession`)                         |
| 3 Autobiographical | `autobiographical_memory`           | `memory_autobiographical_create` / `deprecate`    | Conversation + day's semantic + day's limbic + existing autobiographical |
| 3b                 | `self_blocks.autobiography_summary` | (programmatic compression, no LLM)                | Active autobiographical narratives → summary block refresh               |

**Restraint principle:** Each stage LLM judges "nothing worth recording" → no tool calls, reply skip; program does not skip subsequent stages because prior stage had zero tool calls.

**Dedup (semantic):** **Local only**—compare only against existing memories with same `source_sessions`; cross-thread merging left to deep sleep.

Implementation: [`life/memory/src/light-sleep/run.ts`](../../life/memory/src/light-sleep/run.ts); wiring: [`serve.ts`](../../service/service/src/serve.ts).

### Stage 1 Message Structure

System prompt: self layer six blocks + resident memory (pinned facts, top 20).

| #   | Content                                                                                              |
| --- | ---------------------------------------------------------------------------------------------------- |
| 1   | Full day's conversation: user+assistant, segmented by session ID, with timestamps and context labels |
| 2   | Existing memories: `listBySourceSessions` pre-filter (active memories intersecting day's sessions)   |
| 3   | Semantic extraction instructions + three-tool usage                                                  |

LLM **does not** carry `memory_semantic_search` (message 2 already provided by program).

### `memory_semantic_update` Semantics (Overwrite)

- **Only modifies passed fields**; omitted fields unchanged
- To clear `source_sessions` → explicitly pass `source_sessions: []`
- Omit `source_sessions` → keep original value

### Flow

```
1. Compute CST previous-day time window
2. listSessionIdsUpdatedBetween → involved session list
3. Stage 1: semantic extraction → semantic_memory
4. Stage 2: limbic extraction → limbic_memory
5. Stage 3: autobiographical narrative extraction → autobiographical_memory
6. Stage 3b: compression refresh → self_blocks.autobiography_summary
7. Write light_sleep_state.json
```

### Context Too Large

When single input exceeds ~120k characters, truncate by session `updated_at` descending, append `[Truncated N sessions]` at conversation segment end (same truncation logic reused across stages).

## Deep Sleep

| Attribute  | Value                                                                                                       |
| ---------- | ----------------------------------------------------------------------------------------------------------- |
| Trigger    | Cron only, daily 03:00 (`0 3 * * *`), no manual trigger                                                     |
| Target     | All active `semantic_memory`                                                                                |
| Operations | Contradiction detection + expiry marking, split, dedup merge—three sequential rounds                        |
| Tools      | `memory_semantic_create` / `memory_semantic_update` / `memory_semantic_deprecate` / `memory_semantic_merge` |

### Three Rounds

| Round | Intent                                   | Focus                                                                  |
| ----- | ---------------------------------------- | ---------------------------------------------------------------------- |
| 1     | Contradiction detection + expiry marking | Exclusive contradictions → deprecate; superseded facts → deprecate     |
| 2     | Split                                    | One content with multiple independent facts → split into multiple rows |
| 3     | Dedup merge                              | Duplicate/highly similar → merge into one                              |

**Ordering rationale:** Clean problems first (contradiction+expiry), then refine (split), then merge. Each round sees clean data after prior rounds.

### Contradiction Definition (Exclusive)

Two memories semantically negate each other and cannot be explained by temporal change → contradiction.

- ✓ Contradiction: "daughter born Year of Tiger" vs "daughter born Year of Goat" (zodiac unique)
- ✓ Contradiction: "dislikes spicy food" vs "likes spicy food" (direct negation)
- ✗ Not contradiction: "likes apples" vs "likes cherries" (can coexist)
- ✗ Not contradiction (change): "likes Python" vs "now prefers TypeScript" (both can be valid)

### Message Structure

System prompt: self layer six blocks + resident memory.

| #   | Content                          | Notes                                                                                           |
| --- | -------------------------------- | ----------------------------------------------------------------------------------------------- |
| 1   | Full active semantic memory JSON | **Identical every round → provider cache**                                                      |
| 1.5 | Incremental change summary       | Empty first round; subsequent rounds append prior operations (merged/deprecated/added/modified) |
| 2   | Program pre-filter               | Empty in v1                                                                                     |
| 3   | Instructions                     | Round intent + tool usage                                                                       |

Message 1 is the token hog and grows linearly; kept unchanged to maximize provider cache.

### Message 1.5 Format

```
# Incremental changes (this content is authoritative)

## Processed (ignore these original entries in message 1)
f-001 — merged into f-003
f-010 — expired/deprecated (superseded by new fact)

## New entries (not in message 1)
f-003 (world) "Bob works in Pudong, Shanghai" sources=[s-abc,s-def] observed=2026-05-01T...

## Modified entries (authoritative here, overrides message 1)
f-030 — modified: content updated to "..."
```

### Threshold Strategy

| Full JSON size | Behavior                       |
| -------------- | ------------------------------ |
| < 10k          | Normal                         |
| 10k ~ 100k     | ⚠️ warn log, normal processing |
| 100k ~ 300k    | Batch by type                  |
| > 300k         | ❌ error, refuse               |

### `merge_semantic_memories` Tool

Program auto-stitches fields; LLM only cares about merged new content:

- `source_sessions` → union deduped across source memories
- `observed_at` → earliest value
- Create new memory → deprecate all source_ids
- Only 1 source_id → prompt to use update_semantic_memory

### Operation Log

Each round written to `~/.anima/logs/deep_sleep_{day}_{round_index}_{round}.json`, not in database, for troubleshooting only.

Records: date, round, active memory count, prior change count, tool_calls count, summary, change log snapshot.

## Trigger Mechanism

```cron
0 2 * * *  light-sleep           # builtin-light-sleep (semantic + limbic + autobiographical)
0 3 * * *  deep-sleep            # builtin-deep-sleep
30 5 * * *  memory-reference-sync  # builtin-memory-reference-sync
```

After downtime, next scheduled run catches up; not a real-time system.

## Historical Backfill (One-Time CLI)

For historical conversations before go-live or after migration, run light sleep **per CST calendar day**, same logic as nightly cron but manually triggered with separate progress file.

```bash
anima memory sleep backfill [--from YYYY-MM-DD] [--to YYYY-MM-DD] [--resume]
```

| Option     | Description                                                              |
| ---------- | ------------------------------------------------------------------------ |
| `--from`   | Start date; if omitted, earliest non-debug session CST day in `sessions` |
| `--to`     | End date; if omitted, **yesterday CST** (same as 02:00 cron default day) |
| `--resume` | Continue from progress file, skip completed days                         |

**Progress file:** `~/.anima/runtime/light_sleep_backfill_state.json` (separate from `light_sleep_state.json`).

**Behavior notes:**

- Each day independently calls `runLightSleep({ day })`; single-day failure recorded then continue next day
- Stage 3b (autobiography summary refresh) runs only on **last day** by default; skipped on intermediate days to save tokens
- Before backfill, ensure LLM correctly fills `observed_at` / `occurred_at` (see [`memory.md`](memory.md)); otherwise memory times become backfill moment
- Backfill only writes semantic / limbic / autobiographical; **cross-session semantic merge still relies on deep sleep**—after backfill, wait for 03:00 deep sleep or trigger manually
- No conflict with 02:00 cron, but pause service or avoid early-morning window during backfill
- Single conversation input still capped at ~**120k characters** (see "Context Too Large" above)

Implementation: [`life/memory/src/light-sleep/backfill.ts`](../../life/memory/src/light-sleep/backfill.ts); CLI bootstrap: [`bootstrap-memory-jobs.ts`](../../service/service/src/bootstrap-memory-jobs.ts).

## Relationship to Existing Architecture

```
PG messages (conversation archive)
  │ light sleep cron (02:00, three stages)
  ├─► semantic_memory
  ├─► limbic_memory
  └─► autobiographical_memory ──compress──► self_blocks.autobiography_summary
  │
  │ deep sleep cron (03:00, semantic maintenance)
  ▼
semantic_memory (consolidated)
  │ memory_recall (real-time retrieval in conversation)
  ▼
Agent identity and recalled fragments in current context
```

`session:updated` EventBus event retained (WebUI refresh, etc.), **no longer** triggers reflect.

## `memory_remember` Tool

In-conversation `memory_remember` is a convenience wrapper: auto-infers `source_sessions` (current session) and `observed_at`, underlying `memory_semantic_create` logic. Physical delete via `action=delete`; soft deprecation via `memory_semantic_deprecate`.
