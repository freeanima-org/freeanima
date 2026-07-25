---
title: Service
---

# Service operations

> Runtime status, memory metrics, and common commands.

## Status and memory metrics

`anima service status` and `createTypedHabitatClient().call("status.get")` (REST `GET /rpc/v1/status/get`) report process memory under `memory_kb` and `memory_detail`.

| Field / label                 | Source                                                 | Meaning                                                             |
| ----------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------- |
| `rss (phys)` / `memory_kb`    | Linux `VmRSS`, or `process.memoryUsage().rss` fallback | Physical RAM currently resident for the process                     |
| `heap (jsc)` / `heap_used_kb` | `process.memoryUsage().heapUsed`                       | JavaScriptCore heap accounting (not OS physical memory)             |
| `native` / `external_kb`      | `process.memoryUsage().external`                       | Native objects bound to JS                                          |
| `virtual` / `vm_size_kb`      | Linux `VmSize`                                         | Virtual address space reserved (Gigacage moats); not actual RAM use |

On Bun + JavaScriptCore, `heap (jsc)` can be **much larger than** `rss (phys)`. Use RSS for “how much RAM does anima use?” Use heap trends (over time, after GC) for JS pressure — not absolute comparison against RSS.

Verify from the shell (business API requires a Service API Token — see [`remote-access.md`](remote-access.md)):

```bash
curl -s -H "Authorization: Bearer <fa_at_...>" http://127.0.0.1:2658/rpc/v1/status/get | jq '.memory_kb, .memory_detail'
grep -E '^(VmRSS|VmSize):' /proc/$(pgrep -f 'anima service' | head -1)/status
just misc memory-sample -- --habitat-url http://127.0.0.1:2658 --stage full
```

## Development vs production

| Mode                    | How to run Habitat                                                                                                                |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| **Monorepo / worktree** | `just dev habitat` (default random port ≥10000; optional `--port` / `--strict-port`; source `anima` has **no** `service` command) |
| **Standalone install**  | `anima service start` / `stop` / `status` (systemd user unit; **2658** / TLS **2659**)                                            |

Discord / 微信消息网关的配置见 [`message-gateway.md`](message-gateway.md)。

## Common commands

```bash
# --- standalone install CLI only ---
anima service start          # background (systemd user unit when available)
anima service start --foreground
anima service status
anima service stop
anima service restart

# --- monorepo / worktree ---
just dev                     # Habitat (≥10000) + Vite Web (≥5000); proxy via FREEANIMA_URL
just dev habitat              # Habitat foreground; default random ≥10000; skip Habitat TLS (Vite may HTTPS)
just dev web              # Vite HMR from :5000 (set FREEANIMA_URL to Habitat); browser Habitat = page origin
```

`anima.service` is a **single-unit stack**: Habitat (`:2658`, REST + SAP + bundled `/web` when dist exists) managed by one foreground supervisor.

**Web build is never triggered by `service start`.** Paths:

| Mode               | When to `just pack web`          | UI                                                                    |
| ------------------ | -------------------------------- | --------------------------------------------------------------------- |
| Standalone release | Forced during `just pack cli`    | Embedded, served at `/web/*`                                          |
| Source deploy      | Run `just pack web` before start | Habitat `/web/*` whenever dist exists                                 |
| Dev                | Not required                     | `just dev` / `just dev habitat` + `just dev web` → Web **:5000+** HMR |

When Web dist (`src/portal/app/web/dist` or embedded) is present, the stack serves browser Web UI at `http://<host>:2658/web/*` from Habitat (no separate API proxy). Clients store Habitat URL and **Service API Token** (`fa_at_...`) in **Habitat settings**. Optional Habitat native TLS listens on **`https://<host>:2659`** when `http.tls.enabled: true` (see [`remote-access.md`](remote-access.md)) — **production only**; source `just dev habitat` skips Habitat TLS and lets Vite terminate HTTPS when enabled.

**Startup order:** Habitat must pass `GET /rpc/v1/health/probe` (`status: ok`) before `serve()` `onReady` hooks run. `anima service start` waits up to **15 minutes** by default (`FREEANIMA_HABITAT_READY_TIMEOUT_MS`) because schema migrations run **before** HTTP listen. Remote-tool host disconnects are retried by `@freeanima/shared/rpc-contract` transport (exponential backoff).

**UI access:**

- **Desktop / mobile Portal:** Chat and Habitat inside the Tauri app (not served from Habitat `:2658` unless dist is present and Habitat is hosting `/web`).
- **Browser / PWA:** `http://<host>:2658/web/*` from Habitat when dist is present. Default Habitat URL in `/web/config.json` is the **page origin**.
- **Local Web dev (`just dev web`):** Vite from `:5000` with base `/web/` — Chat `http://127.0.0.1:5000/web/chat`, Habitat `…/web/habitat/dashboard`; `/rpc` and `/mcp` proxied to `FREEANIMA_URL`. Browser Habitat defaults to page origin; `just dev habitat` auto-fills token via `~/.anima/dev-web.token`.
