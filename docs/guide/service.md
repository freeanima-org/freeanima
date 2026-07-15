---
title: Service
---

# Service operations

> Runtime status, memory metrics, and common commands.

## Status and memory metrics

`anima service status` and `hub().call("status.get")` (REST `GET /hub/rpc/v1/status/get`) report process memory under `memory_kb` and `memory_detail`.

| Field / label                 | Source                                                 | Meaning                                                             |
| ----------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------- |
| `rss (phys)` / `memory_kb`    | Linux `VmRSS`, or `process.memoryUsage().rss` fallback | Physical RAM currently resident for the process                     |
| `heap (jsc)` / `heap_used_kb` | `process.memoryUsage().heapUsed`                       | JavaScriptCore heap accounting (not OS physical memory)             |
| `native` / `external_kb`      | `process.memoryUsage().external`                       | Native objects bound to JS                                          |
| `virtual` / `vm_size_kb`      | Linux `VmSize`                                         | Virtual address space reserved (Gigacage moats); not actual RAM use |

On Bun + JavaScriptCore, `heap (jsc)` can be **much larger than** `rss (phys)`. Use RSS for “how much RAM does anima use?” Use heap trends (over time, after GC) for JS pressure — not absolute comparison against RSS.

Verify from the shell (business API requires a Service API Token — see [`remote-access.md`](remote-access.md)):

```bash
curl -s -H "Authorization: Bearer <fa_at_...>" http://127.0.0.1:2658/hub/rpc/v1/status/get | jq '.memory_kb, .memory_detail'
grep -E '^(VmRSS|VmSize):' /proc/$(pgrep -f 'anima service' | head -1)/status
bun run memory:sample -- --hub-url http://127.0.0.1:2658 --stage full
```

## Common commands

```bash
anima service start          # background (systemd user unit when available)
anima service start --foreground
anima service status
anima service stop
anima service restart
anima web start --foreground # standalone Web static server (default :2660; production: web.enabled + service stack)
bun run dev:service          # monorepo: Hub foreground (same as service start --foreground; never auto-builds Web)
bun run dev:web              # monorepo: Vite HMR on :4173 (Hub must already be running)
```

`anima.service` is a **single-unit stack**: Hub (`:2658`, REST + SAP + bundled `/web` when `web.enabled` and dist exists) + optional Tunnel (cloudflared) managed by one foreground supervisor. Legacy `anima-tunnel.service` is disabled on next `service start`.

**Web build is never triggered by `service start` / `anima web start`.** Paths:

| Mode               | When to `build:web`                          | UI                                                      |
| ------------------ | -------------------------------------------- | ------------------------------------------------------- |
| Standalone release | Forced during `bun run build:cli:executable` | Embedded, served at `/web/*`                            |
| Source deploy      | Run `bun run build:web` before start         | Hub `/web/*` when `web.enabled`                         |
| Dev                | Not required                                 | `bun run dev:service` + `bun run dev:web` → `:4173` HMR |

When `config.yaml` has `web.enabled: true` (absent defaults to on) and `src/app/shell/web/dist` (or embedded dist) is present, the stack serves browser Web UI at `http://<host>:2658/web/*` from Hub (no separate API proxy). Clients store Hub URL and **Service API Token** (`fa_at_...`) in **Hub settings**. For standalone static hosting without the Hub process, use `anima web start --foreground` (default `:2660`) after dist exists. Optional Hub native TLS listens on **`https://<host>:2659`** when `http.tls.enabled: true` (see [`remote-access.md`](remote-access.md)).

**Startup order:** Hub must pass `GET /hub/rpc/v1/health/probe` (`status: ok`) before Tunnel sidecars start (`serve()` `onReady` → stack supervisor). SAP disconnects are retried by `@freeanima/sap-contract` transport (exponential backoff).

**UI access:**

- **Desktop / mobile bundled shell:** Chat and Console at `/chat`, `/console`/\*`inside the Electron/Capacitor app (not served from Hub`:2658`unless`web.enabled`).
- **`config.yaml` `web.enabled: true`:** browser UI at `http://<host>:2658/web/*` from Hub when dist is present (see table above). `web` is bootstrap (not PG).
- **Local Web dev (`bun run dev:web`):** Vite on `:4173` with base `/web/` — Chat `http://127.0.0.1:4173/web/chat`, Console `http://127.0.0.1:4173/web/console/dashboard`; Hub serves Hub RPC REST + WS at `/hub/rpc/v1`.
