---
title: Service
---

# Service operations

> Runtime status, memory metrics, and common commands.

## Status and memory metrics

`anima service status` and `/api/status` report process memory under `memory_kb` and `memory_detail`.

| Field / label                 | Source                                                 | Meaning                                                             |
| ----------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------- |
| `rss (phys)` / `memory_kb`    | Linux `VmRSS`, or `process.memoryUsage().rss` fallback | Physical RAM currently resident for the process                     |
| `heap (jsc)` / `heap_used_kb` | `process.memoryUsage().heapUsed`                       | JavaScriptCore heap accounting (not OS physical memory)             |
| `native` / `external_kb`      | `process.memoryUsage().external`                       | Native objects bound to JS                                          |
| `virtual` / `vm_size_kb`      | Linux `VmSize`                                         | Virtual address space reserved (Gigacage moats); not actual RAM use |

On Bun + JavaScriptCore, `heap (jsc)` can be **much larger than** `rss (phys)`. Use RSS for “how much RAM does anima use?” Use heap trends (over time, after GC) for JS pressure — not absolute comparison against RSS.

Verify from the shell:

```bash
curl -s http://127.0.0.1:2658/api/status | jq '.memory_kb, .memory_detail'
grep -E '^(VmRSS|VmSize):' /proc/$(pgrep -f 'anima service' | head -1)/status
bun run memory:sample -- --url http://127.0.0.1:2658/api/status --stage full
```

## Common commands

```bash
anima service start          # background (systemd user unit when available)
anima service start --foreground
anima service status
anima service stop
anima service restart
```

Managed satellites get user units `~/.config/systemd/user/anima-satellite-<name>.service`, enabled on `service start` and stopped with `service stop`. See [`satellite-guide.md`](../sap/satellite-guide.md).

**Startup order:** Hub must pass `GET /api/health` (`status: ok`) before managed satellites are started (foreground uses `serve()` `onReady`; background CLI polls health). SAP disconnects are retried by `@freeanima/sap-contract` transport (exponential backoff).

Admin dashboard dashboard: `http://127.0.0.1:2658/admin/dashboard/dashboard`
