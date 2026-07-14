---
title: Compression
---

# Context Compression

> Runtime context compression: conversations are **fully retained in the database**; only the **four-segment view** sent to the LLM is trimmed.
> Related: [`sleep.md`](sleep.md), [`memory.md`](memory.md).

## Design Principles

| Principle           | Description                                                                    |
| ------------------- | ------------------------------------------------------------------------------ |
| No message deletion | History is kept; compression only changes runtime view and conversation meta   |
| Four segments       | LLM context = system + summary + slim + raw                                    |
| On-demand trigger   | Compress when usage nears window limits; higher thresholds in tool loops       |
| Memory-independent  | Compression does not trigger semantic extraction; light sleep cron is separate |

## Runtime Four Segments

```text
① system  — system prompt (self layer + resident memory + project context)
② summary — text summary of compressed portion (synthetic; not stored in messages)
③ slim    — middle segment: trimmed user/assistant messages
④ raw     — recent segment: full messages including tool calls
```

Non-compression path: append new messages to raw only; boundaries unchanged.

Compression path: when usage exceeds thresholds, older messages move into summary/slim; summary text updated asynchronously.

## Configuration

Adjust in `config.yaml` (full example: repo root `config.example.yaml`):

```yaml
models:
  deepseek-v4-flash:
    context_window: 1000000

compression:
  enabled: true
  reserved_tokens: 8192
  trigger_low: 0.60 # outside tool loop: compress at 60% usage
  trigger_high: 0.80 # inside tool loop: compress at 80% usage
  emergency_ratio: 0.92
  raw_min_messages: 5
  slim_min_messages: 50
  summary_max_tokens: 4000
```

| Setting             | Default | Description                         |
| ------------------- | ------- | ----------------------------------- |
| `trigger_low`       | 0.60    | Threshold in normal conversation    |
| `trigger_high`      | 0.80    | Threshold inside tool loop          |
| `raw_min_messages`  | 5       | Minimum messages in raw segment     |
| `slim_min_messages` | 50      | Minimum messages in slim after trim |

### Token counting

Compression and embedding batch packing use **heuristic token estimates** (`tokenx` in-process, id `__estimate__:tokenx`), not full HuggingFace vocabularies. Counts are approximate (good enough for budget triggers and chunk sizing); they are not provider-billing exact.

### Context window resolution (token mode)

Priority when estimating compression budget:

1. `models.<model>.context_window` in `config.yaml`
2. `compression.default_context_window` (applies to all models)
3. Provider `/models` catalog `contextWindow` (when Hub has registered lookup)
4. Message-count fallback (`max_rounds` thresholds) when none of the above apply

Per-model config always wins over dynamically fetched catalog values; catalog is read-only and never written back to `config.yaml`.

Without any context window source, compression falls back to message-count triggers.

Force compression in chat: `/compress` (`--force` ignores hysteresis).

## Relationship to Memory Pipeline

Compression and light/deep sleep run **independently**: compression manages the current conversation's LLM window; memory extraction runs nightly from the full conversation archive.
