# Compression (l-point v5.1)

> Runtime context compression: PG `messages` **fully append-only**; only the **four-segment view** sent to the LLM is trimmed.
> User-facing overview: [`docs/concepts/compression.md`](../../docs/concepts/compression.md).

## Design Principles

| Principle              | Description                                                                                                                        |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| PG never deletes       | `messages` always retains full conversation; compression only changes **runtime view** and `session_meta.compression`              |
| l4 real-time           | `l4 = max(pos)`, grows with append, **not written to meta**                                                                        |
| Monotonic boundaries   | On successful compression: `new l2 > old l2`, `new l3 ≥ old l3`; otherwise abort                                                   |
| Separation of concerns | **Boundary setting** (`deriveBoundariesFromL4`) decoupled from **trigger** (`shouldAdvance`); only trigger distinguishes tool loop |

## Boundary Points l0–l4

| Point  | Meaning                                                         | When it changes                    | Persisted |
| ------ | --------------------------------------------------------------- | ---------------------------------- | --------- |
| **l0** | System prompt anchor, always **0**                              | Never                              | No        |
| **l1** | Runtime synthetic summary user **pos**, always **1** (**≠ l4**) | Never                              | No        |
| **l2** | Summary segment right boundary (`pos ≤ l2` already summarized)  | **Only on successful compression** | Yes       |
| **l3** | Slim segment right boundary                                     | **Only on successful compression** | Yes       |
| **l4** | Rightmost message pos, `max(pos)`                               | **Real-time** append               | No        |

Hard conventions:

1. **`l1 ≠ l4`:** `l1` is fixed synthetic row pos, unrelated to `max(pos)`.
2. **`l4` has no policy**, not written to meta.
3. **Non-compression path reads meta only**; only successful compression updates `l2`, `l3`, `summary`.
4. **No `l2l`:** summary semantics = **`pos ≤ l2`**.

## Compression Decision Pipeline

| Module                    | Cares about tool loop?                        |
| ------------------------- | --------------------------------------------- |
| `deriveBoundariesFromL4`  | **No** — same right-to-left algorithm         |
| `shouldAdvance`           | **Yes** — different thresholds inside/outside |
| `buildRuntimeFromLPoints` | **No**                                        |

### `deriveBoundariesFromL4`

Input: full message list, current **`l4`**, old `l2/l3`.

1. **Step 1 — Set `l3`:** Take the **largest** `l3` so **`(l3, l4]`** satisfies count ≥ `raw_min_messages`, has user, and hot-tail starts with `user`. No valid `l3` → abort.
2. **Step 2 — Set `l2`:** Take the **largest** `l2` so **`(l2, l3]`** after `slimMessage` has count ≥ `slim_min_messages`. Check `l2 < l3`, `new l3 ≥ old l3`, `new l2 > old l2`.
3. **Step 3 — Summary:** Increment range **`(old l2, new l2]`**; LLM merges into `meta.summary`; runtime injects **`pos=1`** summary user.

### `shouldAdvance`

`isInToolLoop(messages)` **only used here**, **not** in `deriveBoundariesFromL4`.

| Scenario                       | Advance compression?                                             |
| ------------------------------ | ---------------------------------------------------------------- |
| **Outside tool loop**          | `usage ≥ trigger_low` (0.60); `< trigger_low` do not compress    |
| **Inside tool loop**           | Only `usage ≥ trigger_high` (0.80) or `≥ emergency_ratio` (0.92) |
| **Inside tool loop** otherwise | Do not compress                                                  |

Occupancy estimated from four-segment runtime view at current **l4**, **not** full messages.

### `slimMessage`

| role                           | Behavior                                                                                 |
| ------------------------------ | ---------------------------------------------------------------------------------------- |
| `tool`                         | **Dropped**                                                                              |
| `user`                         | Kept (strip `reasoning` / `tool_calls` fields)                                           |
| `assistant` + `tool_calls`     | Non-empty `content` uses content, **else `reasoning`**; strip `tool_calls` / `reasoning` |
| `assistant` without tool_calls | Keep `content`, strip `reasoning`                                                        |

## meta Structure

```json
{
  "l2": 80,
  "l3": 145,
  "summary": "Merged single summary…",
  "summary_at": "2026-05-28T02:00:00+08:00"
}
```

Legacy meta **read-time migration** (`parseCompressionState`):

| Old field                | → New field |
| ------------------------ | ----------- |
| `anchor_id`              | `l3`        |
| `cut_id` (no anchor)     | `l3`        |
| `last_summarized_cut_id` | `l2`        |

## Emergency (Single-Turn Hard Cap)

`maybeApplyEmergencyCompression` (called from engine tool loop):

1. `l4` = current in-memory message `max(pos)`
2. Thresholds follow **inside tool loop** rules (`trigger_high` / `emergency_ratio`)
3. Boundary derivation same as normal; **no extra shift**
4. After meta write, async summary; in-memory view immediately becomes four segments

## Implementation Entry Points

| Module                                       | Responsibility                                                                                |
| -------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `core/src/compress/compressor.ts`            | l-points, `deriveBoundariesFromL4`, `shouldAdvance`, `buildRuntimeFromLPoints`, `slimMessage` |
| `core/src/compress/compression-config.ts`    | Config and `context_window` / effective budget                                                |
| `core/src/compress/compression-summary.ts`   | Summary LLM                                                                                   |
| `core/src/compress/compression-tool-loop.ts` | `isInToolLoop`                                                                                |
| `runtime/src/conversation/conversation.ts`   | `recompressSession`, `buildRuntimeMessages`, `maybeApplyEmergencyCompression`                 |
| `runtime/src/loop/engine.ts`                 | Emergency call site                                                                           |
| `platform/src/runtime/conversation-stats.ts` | `/stats` shows `l2`/`l3`/occupancy                                                            |

Manual: `/compress` (`--force` ignores hysteresis).

Compression **does not** trigger semantic memory extraction; light sleep cron runs independently (see [`docs/concepts/sleep.md`](../../docs/concepts/sleep.md)).
