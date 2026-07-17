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
just memory-sample -- --hub-url http://127.0.0.1:2658 --stage full
```

## Development vs production

| Mode                    | How to run Hub                                                                                                                   |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| **Monorepo / worktree** | `bun run dev:hub` (default random port ≥10000; optional `--port` / `--strict-port`; source `anima` has **no** `service` command) |
| **Standalone install**  | `anima service start` / `stop` / `status` (systemd user unit; **2658** / TLS **2659**)                                           |

Discord / 微信消息网关的配置见 [`message-gateway.md`](message-gateway.md)。

## Common commands

```bash
# --- standalone install CLI only ---
anima service start          # background (systemd user unit when available)
anima service start --foreground
anima service status
anima service stop
anima service restart
anima web start --foreground # standalone Web static server (default :2660; production: web.enabled + service stack)

# --- monorepo / worktree ---
just dev                     # Hub (≥10000) + Vite Web (≥5000); proxy via FREEANIMA_URL
bun run dev:hub              # Hub foreground; default random ≥10000; skip Hub TLS (Vite may HTTPS)
bun run dev:web              # Vite HMR from :5000 (set FREEANIMA_URL to Hub); browser hub = page origin
```

`anima.service` is a **single-unit stack**: Hub (`:2658`, REST + SAP + bundled `/web` when `web.enabled` and dist exists) managed by one foreground supervisor.

**Web build is never triggered by `service start` / `anima web start`.** Paths:

| Mode               | When to `build:web`                          | UI                                                      |
| ------------------ | -------------------------------------------- | ------------------------------------------------------- |
| Standalone release | Forced during `bun run build:cli:executable` | Embedded, served at `/web/*`                            |
| Source deploy      | Run `bun run build:web` before start         | Hub `/web/*` when `web.enabled`                         |
| Dev                | Not required                                 | `just dev` / `dev:hub` + `dev:web` → Web **:5000+** HMR |

When `config.yaml` has `web.enabled: true` (absent defaults to on) and `src/app/shell/web/dist` (or embedded dist) is present, the stack serves browser Web UI at `http://<host>:2658/web/*` from Hub (no separate API proxy). Clients store Hub URL and **Service API Token** (`fa_at_...`) in **Hub settings**. For standalone static hosting without the Hub process, use `anima web start --foreground` (default `:2660`) after dist exists. Optional Hub native TLS listens on **`https://<host>:2659`** when `http.tls.enabled: true` (see [`remote-access.md`](remote-access.md)) — **production only**; source `dev:hub` skips Hub TLS and lets Vite terminate HTTPS when enabled.

**Startup order:** Hub must pass `GET /hub/rpc/v1/health/probe` (`status: ok`) before `serve()` `onReady` hooks run. `anima service start` waits up to **15 minutes** by default (`FREEANIMA_HUB_READY_TIMEOUT_MS`) because schema migrations run **before** HTTP listen. SAP disconnects are retried by `@freeanima/sap-contract` transport (exponential backoff).

**UI access:**

- **Desktop / mobile bundled shell:** Chat and Console at `/chat`, `/console`/\*`inside the Electron/Capacitor app (not served from Hub`:2658`unless`web.enabled`).
- **`config.yaml` `web.enabled: true`:** browser UI at `http://<host>:2658/web/*` from Hub when dist is present (see table above). `web` is bootstrap (not PG). Default Hub URL in `/web/config.json` is the **page origin**.
- **Local Web dev (`bun run dev:web`):** Vite from `:5000` with base `/web/` — Chat `http://127.0.0.1:5000/web/chat`, Console `…/web/console/dashboard`; `/hub` and `/mcp` proxied to `FREEANIMA_URL`. Browser Hub defaults to page origin; `dev:hub` auto-fills token via `~/.anima/dev-web.token`.
