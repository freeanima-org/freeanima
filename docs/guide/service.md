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

Verify from the shell (business API requires a Service API Token — see [`remote-access.md`](remote-access.md)):

```bash
curl -s -H "Authorization: Bearer <fa_at_...>" http://127.0.0.1:2658/api/status | jq '.memory_kb, .memory_detail'
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
anima web start --foreground # standalone Web static server (default :2659; production: web.enabled + service stack)
```

`anima.service` is a **single-unit stack**: Hub (`:2658`, REST + SAP + bundled `/web` when `web.enabled`) + optional Tunnel (cloudflared) managed by one foreground supervisor. Legacy `anima-tunnel.service` is disabled on next `service start`.

When `web.enabled: true`, the stack serves browser Web UI at `http://<host>:2658/web/*` from Hub (no separate API proxy). Clients store Hub URL and **Service API Token** (`fa_at_...`) in **Hub settings**. For standalone static hosting without the Hub process, use `anima web start --foreground` (default `:2659`).

**Startup order:** Hub must pass `GET /api/health` (`status: ok`) before Tunnel sidecars start (`serve()` `onReady` → stack supervisor). SAP disconnects are retried by `@freeanima/sap-contract` transport (exponential backoff).

**UI access (two modes):**

- **Desktop / mobile bundled shell:** Chat and Admin at `/chat`, `/admin/*` inside the Electron/Capacitor app (not served from Hub `:2658` unless `web.enabled`).
- **`web.enabled: true`:** browser UI at `http://<host>:2658/web/*` from Hub (see paragraph above).
- **Local Web dev (`bun run dev:web`):** Vite on `:4173` with base `/web/` — Chat `http://127.0.0.1:4173/web/chat`, Admin `http://127.0.0.1:4173/web/admin/dashboard`; Hub still provides REST `/api/*` and Hub RPC `/hub/rpc/v1`.
