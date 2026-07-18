---
title: Environment Awareness
---

# Environment Awareness

> Hub-process loop: collect environment + health markers → compare baseline → notify on change, stay quiet otherwise.
> Related: [Issue #44](https://github.com/freeanima-org/freeanima/issues/44) (partner-facing health warning), [`self-layer.md`](self-layer.md), [`notifications.md`](notifications.md).

## Two channels

| Channel                        | Cadence                                           | Role                                                                    |
| ------------------------------ | ------------------------------------------------- | ----------------------------------------------------------------------- |
| **System prompt** (session)    | Snapshot at conversation init / CST 02:00 rebuild | Static **environment + health baseline** copy                           |
| **Inbox notification** (event) | On marker change vs baseline                      | Immediate surface to **user + agent**; agent via `notification_context` |

Session prompts are **not** rewritten on every change — live awareness is event-level. The next day-boundary (or new session) picks up the updated baseline.

## Loop (`builtin-env-health`)

Schedule: every 5 minutes (`*/5 * * * *`), Hub cron, `no_agent`.

```text
collect markers (banded)
  → load ~/.anima/env-health-baseline.json
  → no baseline? save & quiet (init)
  → unchanged? quiet
  → changed? notify user+agent (source_ref dedupe) → save baseline
```

Implementation: `src/platform/runtime/env-health/`.

## v1 markers (after banding)

**Environment:** hostname, OS, timezone label, Hub version, boot started_at, PostgreSQL / Redis status (`connected` | `error` | `not_configured`).

**Health:** RSS band (256 MiB), MCP/ACP connection counts, disk free band for `FREEANIMA_HOME` (`<1GiB` | `1-2GiB` | `2-4GiB` | `4-8GiB` | `≥8GiB` | `unknown`).

Continuous metrics are banded so minor jitter does not spam notifications.

## System prompt section

Hook id `env-health-baseline`, order **15** (after toolsets, before memory citation). Registered in `register-prompt-hooks.ts`.

## Notifications

- Recipients: **user and agent**
- `source_kind: system`
- `source_ref: env-health:<sortedChangedKeys>:<fingerprint>`
- If both recipients already have that `source_ref`, skip create (dedupe) but still refresh baseline

## Not this module

- Console health dashboard UI (Issue #21 epic item)
- Scene awareness (dialogue atmosphere)
- Hub HTTP `health.probe` / ACP process health checks (ops, not cognitive baseline)
