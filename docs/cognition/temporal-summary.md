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
| Primary reader | `/diary` UI            | System prompt (three reverse rollups) / timeline inject (today peers)  |

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
{
  window: "day" | "month" | "year",
  period_start: string, // CST YYYY-MM-DD
  empty_reason?: string | null, // e.g. no_sessions / empty / empty_summary / no_days / no_months
  source_count?: number, // conversations or child summaries that contributed
}
```

Unique on `(window, period_start)` for global rows (expression unique index).

**Skip still writes a row**: when there is no usable material (`no_sessions`, empty dialogue, empty LLM output, no child days/months), Habitat upserts `content=""` with `empty_reason` and `source_count` (often `0`). Successful regenerate clears `empty_reason`. Feature-off (`disabled`), cascade `no_trigger`, and LLM hard failures do **not** write placeholders.

Month/year merge and system rolls **ignore** empty-content child rows so placeholders do not pollute rollups.

## Generation（期结束后汇总）

| Step               | Trigger                                                        | Output                                                         |
| ------------------ | -------------------------------------------------------------- | -------------------------------------------------------------- |
| Conversation chunk | in-process `Bun.cron` `builtin-temporal-summary-tick` `*/30`   | Append chunk if **CST-today message activity** after watermark |
| Peer rollup        | Same tick / on assemble for **closed** buckets                 | One merged peer digest per viewer source-set → Redis cache     |
| Global day         | Sleep step `temporal-summary-day` (after light-sleep)          | Overwrite global `day` entity for that sleep day               |
| Month              | Sleep step `temporal-summary-cascade` on **month start** (1st) | Previous month from its day entities                           |
| Year               | Same cascade on **Jan 1**                                      | Previous year from its month entities                          |

Example: on **2026-01-01**, cascade writes December 2025 month (if days exist) and **2025** year (if months exist). Habitat **Catch up sleep** schedules cascade on month-start dates in range.

Tick **does not** use `conversations.updated_at` as the candidate gate. Candidates are conversations with at least one message whose `payload.timestamp` falls on the current CST calendar day. Writing `temporal_day` must **not** bump `updated_at`.

Identity context (self + resident) must ride with LLM summarization calls.

Habitat UI `/web/habitat/temporal-summary`:

- **Regenerate** any day / month / year row (`memory.temporalRegenerate`) — skip paths still upsert placeholders.
- **Backfill missing** (`memory.temporalBackfillMissing`) for the current From/To range: enumerate expected `period_start` values (calendar days / month-01 / year-01-01), run regenerate only for missing rows. **To is capped at CST today** — future dates are never filled. System-rolls tab backfills cache-miss / empty slots via `memory.temporalSystemRollRegenerate`.

### Redis peer rollup key

```text
{prefix}:peer_roll:{cst_date}:{bucket}:{sources_fp}
```

- Default prefix: `anima:temporal` (config `memory.temporal_summary.redis_key_prefix`)
- `sources_fp`: short hash of canonical sorted `(conversation_id, at, summary)` **excluding the viewer**
- Value: `{ summary, sources_fp, created_at }`
- TTL: ~36h (discardable cache via Redis cache layer + in-process fallback)
- Miss: LLM merge (or concatenate truncate if LLM unavailable); Hit: reuse

### Redis system roll keys（系统提示合摘要）

Stable keys (no fingerprint in the path) so Habitat can list cache slots:

```text
{prefix}:sys_roll:past_days:{today}
{prefix}:sys_roll:past_months:{yyyy-mm}
{prefix}:sys_roll:past_years:{yyyy}
```

- Value: `{ summary, sources_fp, created_at }` — reuse when `sources_fp` matches current source rows
- Cap: prompt target `global_day_max_chars` (default **100**); hard truncate at **1.5×** (see below)
- TTL: `peer_roll_ttl_seconds`
- Habitat tab **System rolls**: `memory.temporalSystemRollList` / `memory.temporalSystemRollRegenerate`

## Injection（LLM prefix / KV cache）

System prompt section `temporal-summary` injects **at most three** reverse rollups (near → far), each targeting ≤100 chars (hard cap 1.5×):

| Block  | Sources                                                               | When empty                           |
| ------ | --------------------------------------------------------------------- | ------------------------------------ |
| 过往日 | `day` entities with `period_start` in **this month** and before today | e.g. 1st of month                    |
| 过往月 | `month` entities this year with `period_start` before this month-01   | e.g. January before any month exists |
| 过往年 | `year` entities with `period_start` before this year-01-01            | first year of history                |

Older detail is **not** listed raw: completed months/years already compressed at cascade time. Today peer activity stays on the **timeline** (not system).

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

LLM prompts still ask for ~`maxChars` 字. Post-processing hard-truncates at `ceil(maxChars * 1.5)` so CJK/EN mix undercounting does not clip headlines at the prompt target.

If the assembled system section exceeds `system_prompt_max_chars`, Habitat truncates and writes an Inbox warning to **both** user and agent subjects (`source_ref` `temporal_summary:system_truncated:{CST_date}`), at most once per CST day. Soft failures in tick chunk / peer-roll (`temporal_summary:tick_soft_fail:{CST_date}`) and whole inject catch (`temporal_summary:inject_failed:{CST_date}`) use the same dual-Inbox window — see [Bypassable soft failure](notifications.md#bypassable-soft-failure).

## Sleep relationship

Global day overwrite is a **side product** of the sleep cycle, not a replacement for light-sleep semantic / limbic / autobiography stages.

Habitat **Catch up sleep** backfills missing global `day` entities (and month/year cascade on month starts in range) alongside missing light-sleep; see [`sleep.md`](sleep.md) Historical Day.
