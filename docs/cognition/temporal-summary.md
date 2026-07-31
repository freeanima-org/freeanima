---
title: Temporal Summary
---

# Temporal Summary（时间摘要）

> Objective, indiscriminate digests of conversation activity over time buckets.
> Related: [`memory.md`](memory.md), [`sleep.md`](sleep.md), [`diary.md`](../modules/diary.md), [`compression.md`](compression.md), [`entity-model.md`](../product/entity-model.md).

## Naming

**时间摘要** (`temporal_summary`) — digests **of conversation content**, bucketed by **day / month / year**. Not a memory taxonomy entry (semantic / limbic / narrative), not diary prose, not the runtime compression `summary` segment.

## vs Diary

| Axis           | Diary                  | Temporal summary                                                       |
| -------------- | ---------------------- | ---------------------------------------------------------------------- |
| Stance         | Subjective             | Objective                                                              |
| Selection      | Editorial              | Indiscriminate coverage of active sessions                             |
| Storage        | `diary_entry` + blocks | Global → entity; today per-conversation → `conversations.temporal_day` |
| Primary reader | `/diary` UI            | System prompt (yesterday+) / timeline inject (today peers)             |

LLM compression still applies (char caps). **Not the memory main store** (semantic / limbic / narrative live elsewhere — see [`memory.md`](memory.md)). Temporal summary is a **time-awareness digest**: highly compressed headlines, not detail replay. Same char budget over larger windows ≈ human-like decay (year still ~100 chars). **Objective ≠ exhaustive log replay**: cover themes without an editorial filter, omit IDs / step-by-step tool actions / per-notification timestamps.

## Storage layers

| Layer                           | Where                                           | Citable (`[[anima:id]]`) |
| ------------------------------- | ----------------------------------------------- | ------------------------ |
| Global day / month / year       | `entities` `primary_component=temporal_summary` | Yes                      |
| Conversation day chunks (today) | `conversations.temporal_day` JSONB              | **No** (operational)     |

### Conversation JSONB

```ts
{
  cst_date: string,
  chunks: Array<{
    at: string,
    bucket: string, // CST half-hour bucket start, e.g. 2026-07-18T06:00+08:00
    summary: string,
    watermark_message_id?: string,
    watermark_at?: string,
  }>
}
```

Chunks are **append-only** within a CST day. Tick only pushes new chunks when there are **CST-today** messages after `max(watermark_at, CST day start)`.

### Global entity body

```ts
{ window: "day" | "month" | "year", period_start: string } // CST YYYY-MM-DD
```

Unique on `(window, period_start)` for global rows (expression unique index).

## Generation

| Step               | Trigger                                                            | Output                                                         |
| ------------------ | ------------------------------------------------------------------ | -------------------------------------------------------------- |
| Conversation chunk | in-process `Bun.cron` `builtin-temporal-summary-tick` `*/30`       | Append chunk if **CST-today message activity** after watermark |
| Peer rollup        | Same tick / on assemble for **closed** buckets                     | One merged peer digest per viewer source-set → Redis cache     |
| Global day         | Sleep step `temporal-summary-day` (after light-sleep)              | Overwrite global `day` entity for sleep day                    |
| Month / year       | Sleep step `temporal-summary-cascade` (after temporal-summary-day) | Month on month-end; year on Dec 31                             |

Tick **does not** use `conversations.updated_at` as the candidate gate (opening a chat / rebuilding system prompt / writing `temporal_day` can bump that column without new messages). Candidates are conversations with at least one message whose `payload.timestamp` falls on the current CST calendar day. Material for each chunk is messages after `max(watermark_at, CST day start)` — never a cross-day dump of older history when the day rolls and chunks reset. Writing `temporal_day` must **not** bump `updated_at`.

Identity context (self + resident) must ride with LLM summarization calls.

### Redis peer rollup key

```text
{prefix}:peer_roll:{cst_date}:{bucket}:{sources_fp}
```

- Default prefix: `anima:temporal` (config `memory.temporal_summary.redis_key_prefix`)
- `sources_fp`: short hash of canonical sorted `(conversation_id, at, summary)` **excluding the viewer**
- Value: `{ summary, sources_fp, created_at }`
- TTL: ~36h (discardable cache via Redis cache layer + in-process fallback)
- Miss: LLM merge (or concatenate truncate if LLM unavailable); Hit: reuse

Same source set shares one key across viewers that exclude the same peers.

## Injection（LLM prefix / KV cache）

| Content                       | Where                                    | When it changes               |
| ----------------------------- | ---------------------------------------- | ----------------------------- |
| Yesterday … earlier (rolling) | System prompt section `temporal-summary` | CST 02:00 rebuild only        |
| Today other sessions          | **Not** system                           | Closed half-hour buckets only |

### Today: timeline insert (one block per closed bucket)

When assembling messages for viewer `V`:

1. For each **closed** CST half-hour bucket today, collect other sessions’ chunks in that bucket.
2. Resolve peer rollup via Redis key above → **one** summary string.
3. Insert a runtime-only assistant message (`name: temporal_summary_peers`) at `bucket_end` on `V`’s timeline (by message timestamps).
4. Never rewrite older buckets; new activity only opens newer buckets → stable prefix for LLM KV cache across parallel sessions.

**Forbidden:** putting today peers in system prompt; per-turn tail replace of a stable today block; injecting N raw peer chunks side-by-side for one bucket.

## Config

`memory.temporal_summary` in Habitat runtime config (`habitat_runtime_config`): `enabled`, char caps, `redis_key_prefix`.

Default char caps (headline / one-line compression):

| Cap                       | Default |
| ------------------------- | ------- |
| `chunk_max_chars`         | 50      |
| `peer_roll_max_chars`     | 100     |
| `global_day_max_chars`    | 100     |
| `month_max_chars`         | 100     |
| `year_max_chars`          | 100     |
| `system_prompt_max_chars` | 1500    |

If the assembled system section exceeds `system_prompt_max_chars`, Habitat truncates and writes an Inbox warning to **both** user and agent subjects (`source_ref` `temporal_summary:system_truncated:{CST_date}`), at most once per CST day.

## Sleep relationship

Global day overwrite is a **side product** of the sleep cycle, not a replacement for light-sleep semantic / limbic / autobiography stages.

Habitat **Catch up sleep** backfills missing global `day` entities (and month/year cascade for month-ends in range) alongside missing light-sleep; see [`sleep.md`](sleep.md) Historical Day.
