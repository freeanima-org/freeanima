---
title: Hub RPC
---

# Hub RPC

**Hub RPC** (`HubRPC/1.0`) is the WebSocket transport between any Hub client and the agent runtime. It is implemented in [`src/shared/hub-rpc/`](../../src/shared/hub-rpc/) and served at **`/hub/rpc/v1`**.

SAP (`SAP/1.0`) is a **session layer** on top of Hub RPC: true satellites call `sap.attach` after connect; bundled SPA modules **never** attach.

## Endpoint

```text
ws://{hub_host}:{port}/hub/rpc/v1
```

Derive from Hub HTTP URL: replace `http` with `ws`, strip trailing slash, append `/hub/rpc/v1`. Helpers: `resolveHubRpcWsUrl` in `@freeanima/hub-rpc`.

Hub route: [`src/platform/sap/bun-route.ts`](../../src/platform/sap/bun-route.ts).

## Envelope kinds

| `kind`      | Direction    | Purpose                                           |
| ----------- | ------------ | ------------------------------------------------- |
| `connect`   | Client → Hub | First frame; `protocol: HubRPC/1.0`, `auth_token` |
| `connected` | Hub → Client | `session_id`, `heartbeat_interval_sec`            |
| `req`       | Client → Hub | RPC (`id`, `method`, `payload`)                   |
| `res`       | Hub → Client | RPC reply                                         |
| `evt`       | Both         | Async event (incl. `heartbeat`)                   |

Parse/serialize: `parseHubRpcEnvelope` / `serializeHubRpcEnvelope` in `@freeanima/hub-rpc`.

## Authentication

Every connection must send a valid **service API token** in the `connect` payload (`auth_token`). The Hub verifies it with `verifyServiceApiToken` ([`src/core/db/pg/service-api-token/`](../../src/core/db/pg/service-api-token/)).

Bundled clients read the token from `window.satelliteShell.remoteAuth.token` (shell bridge). Hub-hosted Web on loopback receives `auth_token` in `/web/config.json` when `~/.anima/web/loopback-auth.token` or `FREEANIMA_REMOTE_AUTH_TOKEN` is set (`anima token pin-loopback`). Local Vite dev may seed via `FREEANIMA_REMOTE_AUTH_TOKEN` or Hub setup UI.

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
