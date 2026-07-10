---
title: Hub RPC
---

# Hub RPC

**Hub RPC** (`HubRPC/1.0`) is the **single business channel** between Hub clients and the agent runtime. Transport:

- **WebSocket** — long-lived connection at **`/hub/rpc/v1`** (connect handshake + heartbeat)
- **HTTP POST** — stateless request/response at **`/hub/rpc/v1`** (same `req`/`res` envelope, `Authorization: Bearer`)

Implemented in [`src/shared/hub-rpc/`](../../src/shared/hub-rpc/) (envelope) and [`src/platform/hub/http-rpc.ts`](../../src/platform/hub/http-rpc.ts) (HTTP adapter).

Infrastructure HTTP **outside** Hub RPC: `GET /api/health`, `POST /api/tts/synthesize`.

SAP (`SAP/1.0`) is a **session layer** on top of Hub RPC WebSocket: true satellites call `sap.attach` after connect; bundled SPA modules **never** attach.

## Endpoints

```text
ws://{hub_host}:{port}/hub/rpc/v1    # WebSocket upgrade
http://{hub_host}:{port}/hub/rpc/v1  # POST (HubRPC req/res)
```

Derive WS URL from HTTP: replace `http` with `ws`, append `/hub/rpc/v1`. Helpers: `resolveHubRpcWsUrl` in `@freeanima/hub-rpc`.

Hub route: [`src/platform/sap/bun-route.ts`](../../src/platform/sap/bun-route.ts).

## Envelope kinds

| `kind`      | Direction    | Purpose                                                    |
| ----------- | ------------ | ---------------------------------------------------------- |
| `connect`   | Client → Hub | WS only: first frame; `protocol: HubRPC/1.0`, `auth_token` |
| `connected` | Hub → Client | WS only: `session_id`, `heartbeat_interval_sec`            |
| `req`       | Client → Hub | RPC (`id`, `method`, `payload`)                            |
| `res`       | Hub → Client | RPC reply                                                  |
| `evt`       | Both         | Async event (WS only; incl. `heartbeat`)                   |

HTTP POST sends a single `req` envelope; Hub responds with one `res` envelope (no `connect` frame — use Bearer token).

Method contracts live in [`src/shared/hub-contract/registry/`](../../src/shared/hub-contract/registry/) (`transports: http | ws` only — **no REST paths**). Handlers register via `feature/plugin.hub.rpc`.

## Authentication

Every **WebSocket** connection must send a valid **service API token** in the `connect` payload (`auth_token`). **HTTP POST** uses `Authorization: Bearer fa_at_...` on each request. The Hub verifies with `verifyServiceApiToken` ([`src/core/db/pg/service-api-token/`](../../src/core/db/pg/service-api-token/)).

Bundled clients read the token from `window.satelliteShell.remoteAuth.token` (shell bridge), configured in client **Hub settings** (`/setup` or settings panel). Hub `/web/config.json` does not include tokens.

## Client profiles

| Profile           | Package entry                                    | `sap.attach` | Typical consumer                               |
| ----------------- | ------------------------------------------------ | ------------ | ---------------------------------------------- |
| Bundled SPA       | `getBundledHubRpcClient()` / `whenHubRpcReady()` | **No**       | Chat, task, notification, diary, email modules |
| Satellite process | `createSatelliteHub()` in sap-contract           | **Yes**      | companion                                      |

Bundled SPA shares **one** Hub RPC WebSocket per page load. Modules call SAP-shaped RPC methods (`conversation.*`, `task.*`, …) directly on that transport.

Satellite processes connect with Hub RPC, then `sap.attach` with `app_id` / `instance_id` before `tool.register` or instance-scoped methods.

## Reconnect

Use `runHubRpcTransport` for connect, heartbeat, and exponential backoff (default 1s → 30s cap). On satellite detach or socket close, Hub unregisters tools for that instance.

See also: [transport.md](transport.md) (full state machine), [overview.md](overview.md).
