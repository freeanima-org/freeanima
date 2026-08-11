---
title: Service
---

# Service operations

> Runtime status, memory metrics, and common commands.

In Habitat chat, the agent can load ToolSet **`ops`** (`toolset_load(["ops"])`) for on-demand health/status, sanitized config, and partner-confirmed config patch / restart — see [`docs/tools/ops.md`](../tools/ops.md).

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
| **Standalone install**  | `anima service start` / `stop` / `status` (systemd user unit; **2658** / TLS **2659**; **Linux x64 only**)                        |

Windows source development uses the monorepo path (`just dev` / `just dev habitat`); there is no Windows `anima service` binary — see [`windows-dev.md`](windows-dev.md).

Discord / 微信消息网关的配置见 [`message-gateway.md`](message-gateway.md)。

## LLM connections (Format / Preset)

Each `llm.providers.<id>` entry is a **Connection** (credentials + endpoint). Concepts:

| Concept | Config              | Meaning                                                                      |
| ------- | ------------------- | ---------------------------------------------------------------------------- |
| Format  | `format`            | Wire protocol: `openai_compatible`, `openai_responses`, `anthropic_messages` |
| Preset  | `preset`            | Built-in recipe: `deepseek`, `openrouter`, `opencode_go`, or `custom`        |
| Profile | `llm.profiles.<id>` | Scene routing + chain failover                                               |

- **Single-format presets** (`deepseek`, `openrouter`): fixed Format + default `base_url`.
- **Gateway preset** (`opencode_go`): base `https://opencode.ai/zen/go/v1`; Format is chosen **per model** (Chat Completions / Responses / Messages). See [OpenCode Go endpoints](https://opencode.ai/docs/zh-cn/go#api-%E7%AB%AF%E7%82%B9).
- **Custom**: set `format` + `base_url` yourself。PG `habitat_runtime_config.llm` 中遗留 `backend` 由迁移改写为 `format`；加载时 `normalizeLlmProviderRaw` 仍可消化未落库的旧 YAML。
- There is **no** built-in `openai` preset.
- **API keys**: plaintext in config, or `vault(...)` / `env(...)` references. Settings UI does **not** auto-mask secrets.

### models.dev metadata

[models.dev](https://models.dev) is an open catalog of model limits, pricing, and capabilities. FreeAnima loads it via `@opencode-ai/models` (live `/api.json`, snapshot fallback) and uses it in these places:

1. **Catalog enrich** — After Connection `GET /models`, merge context / max output / display name / USD-per-1M cost when ids match (provider non-default limits win over models.dev).
2. **`getModel` fallback** — Anthropic Messages / OpenAI Responses / flaky compatible gateways that lack a real catalog use models.dev instead of a blind 128k default when the id is known.
3. **Compression context fallback** — Catalog `contextWindow` (possibly enriched) is still the third priority under runtime `models.<id>.context_window` and `compression.default_context_window` (see [`compression.md`](../cognition/compression.md)).
4. **Scene model picker** — Settings → Habitat 服务配置 → LLM → 场景路由：browse/search models via Habitat RPC `config.listProviderModels` (provider catalog first; preset slice from models.dev if `/models` is empty). Free-text model ids remain allowed.

**Not in scope:** models.dev does not replace Connection credentials or endpoints; it does not bill usage; capability flags are hints only, not runtime guarantees.

### Timeouts

`llm.providers.<id>` supports three timeout layers (chat stream / non-stream; embedding still uses only `timeout_ms`):

| Field                   | Default          | Meaning                                              |
| ----------------------- | ---------------- | ---------------------------------------------------- |
| `timeout_ms`            | `600000` (10min) | Overall wall clock: request start → end              |
| `first_byte_timeout_ms` | `30000`          | First byte: first stream chunk / non-stream response |
| `idle_timeout_ms`       | `120000`         | Chunk idle (stream only); must be ≤ `timeout_ms`     |

`first_byte_timeout_ms` / `idle_timeout_ms` must also be ≤ `timeout_ms`. Timeouts still map to `ProviderErrorCode=timeout` (messages include `first_byte` / `overall` / `idle`).

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
