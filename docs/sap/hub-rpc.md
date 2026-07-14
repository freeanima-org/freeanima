---
title: Hub RPC
---

# Hub RPC

**Hub RPC** (`HubRPC/1.0`) is the **single business channel** between Hub clients and the agent runtime. Transport:

- **WebSocket** — long-lived connection at **`/hub/rpc/v1`** (connect handshake + heartbeat; HubRPC `req`/`res`/`evt` envelope)
- **HTTP REST** — stateless GET/POST at **`/hub/rpc/v1/{method/path}`** (plain JSON body or query; `Authorization: Bearer`)

Implemented in [`src/shared/hub-rpc/`](../../src/shared/hub-rpc/) (WS envelope + HTTP REST helpers) and [`src/platform/hub/http-rest-router.ts`](../../src/platform/hub/http-rest-router.ts) (HTTP adapter).

Binary HTTP methods (e.g. `tts.synthesize`, companion assets, TLS PEM/QR) use Hub RPC REST with registry `request` / `response` encoding. Public probes (`health.probe`, `tls.ca.*`) are Hub RPC methods with `auth: optional` — `GET /hub/rpc/v1/health/probe`, `GET /hub/rpc/v1/tls/ca`, etc.

SAP (`SAP/1.0`) is a **session layer** on top of Hub RPC WebSocket: true satellites call `sap.attach` after connect; bundled SPA modules **never** attach.

## Endpoints

```text
ws://{hub_host}:{port}/hub/rpc/v1              # WebSocket upgrade (HubRPC envelope)
http://{hub_host}:{port}/hub/rpc/v1/task/list  # GET (read-only methods)
http://{hub_host}:{port}/hub/rpc/v1/task/create # POST (write methods)
```

Derive WS URL from HTTP: replace `http` with `ws`, append `/hub/rpc/v1`. Helpers: `resolveHubRpcWsUrl`, `buildHubRestRequest` in `@freeanima/shared/hub-rpc`.

Hub route: [`src/platform/sap/bun-route.ts`](../../src/platform/sap/bun-route.ts).

## HTTP REST mapping

Hub method `domain.action` maps to path **`/hub/rpc/v1/domain/action`** (dots → slashes; camelCase preserved).

| Kind           | HTTP     | Example                                                             |
| -------------- | -------- | ------------------------------------------------------------------- |
| Read-only      | **GET**  | `GET /hub/rpc/v1/task/list?subject_kind=user`                       |
| Write          | **POST** | `POST /hub/rpc/v1/task/create` `{ subject_kind, title, … }`         |
| By id (read)   | **GET**  | `GET /hub/rpc/v1/task/get/42?subject_kind=user`                     |
| By id (write)  | **POST** | `POST /hub/rpc/v1/task/patch/42` `{ subject_kind, title?, … }`      |
| Sensitive read | **POST** | `POST /hub/rpc/v1/vault/get/3` `{ subject_kind, include_secrets? }` |

Route metadata is generated from [`hub-contract`](../../src/shared/hub-contract/) (`meta.http`: `verb`, `path`, `pathParams`). Wrong verb on a known path → **405**; legacy `POST /hub/rpc/v1` envelope → **410**.

HTTP responses are **plain handler JSON** (not HubRPC `res` envelope). Errors: `{ "error": { "code", "message" } }` with 4xx/5xx status.

## WebSocket envelope kinds

| `kind`      | Direction    | Purpose                                                    |
| ----------- | ------------ | ---------------------------------------------------------- |
| `connect`   | Client → Hub | WS only: first frame; `protocol: HubRPC/1.0`, `auth_token` |
| `connected` | Hub → Client | WS only: `session_id`, `heartbeat_interval_sec`            |
| `req`       | Client → Hub | RPC (`id`, `method`, `payload`)                            |
| `res`       | Hub → Client | RPC reply                                                  |
| `evt`       | Both         | Async event (WS only; incl. `heartbeat`)                   |

HTTP REST uses Bearer on each GET/POST unless the method declares `auth: optional` (e.g. `health.probe`, `tls.ca.*`). WebSocket uses `connect` frame `auth_token` (required).

Method contracts live in [`src/shared/hub-contract/registry/`](../../src/shared/hub-contract/registry/) (`transports: http | ws`; HTTP routes in `meta.http`). Handlers register via `feature/plugin.hub.rpc`.

## Authentication

Every **WebSocket** connection must send a valid **service API token** in the `connect` payload (`auth_token`). **HTTP REST** uses `Authorization: Bearer fa_at_...` on each request unless the method registry marks `auth: optional` (public read-only probes only). The Hub verifies with `verifyServiceApiToken` ([`src/core/db/pg/service-api-token/`](../../src/core/db/pg/service-api-token/)).

Bundled clients read the token from `window.satelliteShell.remoteAuth.token` (shell bridge), configured in client **Hub settings** (`/settings`). Hub `/web/config.json` does not include tokens.

## Binary HTTP methods

Registry `meta.http` may set `request` / `response` encoding (default `json`):

| Encoding             | Use                                                                                                         |
| -------------------- | ----------------------------------------------------------------------------------------------------------- |
| `response: raw`      | Handler returns `Response` (PEM, PNG, VRM, MPEG, octet-stream). Client: `callRaw()` or `fetchHubRestRaw()`. |
| `request: multipart` | POST with `FormData` body (e.g. `companion.model.upload`).                                                  |
| `request: raw`       | POST body read from `ctx.httpRequest` in handler.                                                           |

Examples: `tts.synthesize` (JSON POST → MPEG stream), `companion.asset.get` (GET → VRM), `tls.ca` (GET → PEM).

Helpers: `hubRestUrl()`, `binaryHttpMeta()` / `rawPublicHttpMeta()` in hub-contract. JSON methods continue to use `hubClient.call()`.

## Client profiles

| Profile           | Package entry                                    | `sap.attach` | Typical consumer                               |
| ----------------- | ------------------------------------------------ | ------------ | ---------------------------------------------- |
| Bundled SPA       | `getBundledHubRpcClient()` / `whenHubRpcReady()` | **No**       | Chat, task, notification, diary, email modules |
| Satellite process | `createSatelliteHub()` in sap-contract           | **Yes**      | companion                                      |

Bundled SPA shares **one** Hub RPC WebSocket per page load (for streaming, subscriptions, and WS fallback). **`hub-client.call()`** picks transport per method: **read-only** dual-transport methods default to **HTTP GET**; **writes** default to **WebSocket** (`dualTransportMeta` in hub-contract). WS failure on a read-only call falls back to the other channel when `fallback` is enabled.

Satellite processes connect with Hub RPC, then `sap.attach` with `app_id` / `instance_id` before `tool.register` or instance-scoped methods.

## Reconnect

Use `runHubRpcTransport` for connect, heartbeat, and exponential backoff (default 1s → 30s cap). On satellite detach or socket close, Hub unregisters tools for that instance.

See also: [transport.md](transport.md) (full state machine), [overview.md](overview.md).
