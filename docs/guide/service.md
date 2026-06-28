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
anima web start --foreground # 独立 Web 静态服（默认 :2659；生产推荐 web.enabled + service stack）
```

`anima.service` 为 **单 unit stack**：Hub（`:2658`）+ 可选 Web（`:2659`）+ 可选 Tunnel（cloudflared）由同一 foreground supervisor 管理。旧版 `anima-tunnel.service` 在下次 `service start` 时自动停用。

配置 `web.enabled: true` 时 stack 会托管浏览器 Web UI（静态文件，不代理 Hub API）。Hub 与 Web **分端口**；浏览器在设置页填写 Hub 地址与 `remote_auth` token。

**Startup order:** Hub must pass `GET /api/health` (`status: ok`) before Web/Tunnel sidecars start (`serve()` `onReady` → stack supervisor). SAP disconnects are retried by `@freeanima/sap-contract` transport (exponential backoff).

Admin dashboard dashboard: `http://127.0.0.1:2658/admin/dashboard/dashboard`
