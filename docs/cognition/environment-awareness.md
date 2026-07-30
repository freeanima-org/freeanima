---
title: Environment Awareness
---

# Environment Awareness

> Habitat-process loop: collect environment + health markers → compare baseline → notify on change, stay quiet otherwise.
> Related: [Issue #44](https://github.com/freeanima-org/freeanima/issues/44) (partner-facing health warning), [`self-layer.md`](self-layer.md), [`notifications.md`](notifications.md).

## Two channels

| Channel                        | Cadence                                           | Role                                                                    |
| ------------------------------ | ------------------------------------------------- | ----------------------------------------------------------------------- |
| **System prompt** (session)    | Snapshot at conversation init / CST 02:00 rebuild | Static **environment + health baseline** (+ 用户活跃统计)               |
| **Inbox notification** (event) | On marker change vs baseline                      | Immediate surface to **user + agent**; agent via `notification_context` |

Session prompts are **not** rewritten on every change — live awareness is event-level. The next day-boundary (or new session) picks up the updated baseline.

## Loop (`builtin-env-health`)

Schedule: every 5 minutes (`*/5 * * * *`), Habitat **in-process `Bun.cron`** (not PG `cron_jobs` / `cron_log`).

```text
collect markers (banded)
  → load baseline (Redis KV `anima:kv:env-health-baseline`, else file fallback)
  → no baseline? save & quiet (init)
  → unchanged? quiet
  → changed? notify user+agent (source_ref dedupe) → save baseline
```

Implementation: `src/host/platform/service/env-health/`.

**Storage:** baseline is **KV** (no TTL) via `connectors/redis` — Redis when configured; otherwise `~/.anima/env-health-baseline.json`. On first Redis hit after an old file exists, migrate once and delete the file. Do not confuse with **Cache** (`anima:cache:*`, TTL) used by 用户活跃统计.

## v1 markers (after banding)

**Environment:** hostname, OS, timezone label, Habitat version, boot started_at, PostgreSQL / Redis status (`connected` | `error` | `not_configured`).

**Health:** RSS band (512 MiB), MCP connection counts, disk free band for `FREEANIMA_HOME` (`<1GiB` | `1-2GiB` | `2-4GiB` | `4-8GiB` | `≥8GiB` | `unknown`).

Continuous metrics are banded so minor jitter does not spam notifications.

## System prompt sections

| Hook id               | Order | Content                                                                |
| --------------------- | ----- | ---------------------------------------------------------------------- |
| `env-health-baseline` | 15    | Environment + health baseline                                          |
| `user-activity-stats` | 16    | **用户活跃统计** panel (CST windows; day-cached; **no** change notify) |

Registered in `register-prompt-hooks.ts`.

### 用户活跃统计 panel

User-side dialogue density only (新开 / 更新会话、用户消息 — not agent/tool traffic). CST calendar windows: 今天 / 昨天 / 前天 / 近 7·30·90 天 / 近 1 年. Excludes `debug` and `cron`. Refreshes with system-prompt day boundary; same CST day reuses Cache (`anima:cache:user-activity-stats`). Implementation: `src/host/platform/service/user-activity-stats/`.

## Notifications

- Recipients: **user and agent**
- `source_kind: system`
- `source_ref: env-health:<sortedChangedKeys>:<fingerprint>`
- If both recipients already have that `source_ref`, skip create (dedupe) but still refresh baseline
- **Dev Habitat** (`FREEANIMA_DEV_HABITAT=1` / `just dev habitat`): ignore `boot_started_at` for notify (still refresh baseline). Other marker changes still notify; production / standalone restart still notifies on boot.

The user-activity panel does **not** emit change notifications.

## Not this module

- Habitat health dashboard UI (Issue #21 epic item)
- Scene awareness (dialogue atmosphere)
- Habitat HTTP `health.probe` / MCP process health checks (ops, not cognitive baseline)
- Recent-memory / cross-session summary injection
