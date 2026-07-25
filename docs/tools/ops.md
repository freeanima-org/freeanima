---
title: ops ToolSet
---

# ops ToolSet

On-demand Habitat ToolSet for **Habitat process operations**: health, status, sanitized runtime config, and partner-confirmed config patch / restart. Load with:

```text
toolset_load(["ops"])
```

## Tools

| Tool               | Purpose                                                                                          |
| ------------------ | ------------------------------------------------------------------------------------------------ |
| `ops_health`       | Process health (`status`, `version`, `started_at`)                                               |
| `ops_status`       | Full service snapshot (memory, PG/Redis, MCP/ACP, conversation counts)                           |
| `ops_config_get`   | Runtime config with secrets masked as `***`; optional `section`                                  |
| `ops_config_patch` | Deep-merge a runtime config section; **requires `confirm: true`** after partner clarify approval |
| `ops_restart`      | Schedule Habitat restart; **requires `confirm: true`** after partner clarify approval            |

## Confirm flow (writes)

1. Call ToolSet `clarify` to ask the partner whether to patch config or restart.
2. After approval, call `ops_config_patch` / `ops_restart` with `confirm: true`.
3. Without `confirm: true`, the write tool returns an error (no awaiting state machine inside `ops`).

## Boundaries

| Do                                                     | Do not                                                           |
| ------------------------------------------------------ | ---------------------------------------------------------------- |
| Inspect status / masked config when diagnosing Habitat | Expect secrets in tool results (always `***`)                    |
| Patch non-secret runtime sections after clarify        | Patch `database` / `http` / `redis` (bootstrap; YAML cold-start) |
| Restart after clarify when a setting requires reboot   | Write MCP `env` / `headers` or secret keys via LLM tools         |
| Use Habitat settings UI / vault for credentials        | Use `ops` for cron (use ToolSet `cron`)                          |
| Read product docs via `freeanima_docs` (`ops/` prefix) | Expose this ToolSet on Habitat `/mcp`                            |

`ops` is **not** in the default conversation toolsets; load it when needed.
