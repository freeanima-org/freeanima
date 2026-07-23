---
title: Habitat RPC
---

# Habitat RPC

**Habitat RPC** is the **single business channel** between Habitat clients and the agent runtime. The TypeScript constant is `HABITAT_RPC_VERSION`. Transport:

- **WebSocket** — long-lived connection at **`/rpc/v1`** (connect handshake + heartbeat; Habitat RPC `req`/`res`/`evt` envelope)
- **HTTP REST** — stateless GET/POST at **`/rpc/v1/{method/path}`** (plain JSON body or query; `Authorization: Bearer`)

Implemented in [`src/shared/habitat-rpc/`](../../src/shared/habitat-rpc/) (WS envelope + HTTP REST helpers) and [`src/platform/habitat/http-rest-router.ts`](../../src/platform/habitat/http-rest-router.ts) (HTTP adapter). Feature method schemas live under [`src/shared/rpc-contract/`](../../src/shared/rpc-contract/).

Binary HTTP methods (e.g. `tts.synthesize`, companion assets, TLS PEM/QR) use Habitat RPC REST with registry `request` / `response` encoding. Public probes (`health.probe`, `tls.ca.*`) are Habitat RPC methods with `auth: optional`.

## Tools: MCP first, remote registration rare

| Situation                                                    | Mechanism                                                             |
| ------------------------------------------------------------ | --------------------------------------------------------------------- |
| Peer is dialable (has a stable inbound MCP/HTTP listener)    | **MCP** — expose tools to each other                                  |
| Product UI (Chat, Task, Settings, …)                         | Habitat RPC only — **no** remote-tool attach                          |
| Unreachable local app (no inbound listener Habitat can dial) | App **actively connects** and registers remote tools over Habitat RPC |

Desktop companion is the in-tree example of the third row. Future independent local apps may do the same without being a Portal shell.

## Remote tool registration

After Habitat RPC `connect`, an unreachable local app calls:

1. `remote_tools.attach` — registers with `app_id` + optional `instance_id` (omit on first register; Habitat assigns; same machine may have multiple instances)
2. `tool.register` — publishes local tools
3. Habitat later sends `tool.call` events; the app replies with `tool.result` / `tool.error`

Routing key is **`instance_id`** (follows the connecting application, not the Portal shell). Tool names use the `remote_{app}_{instance}_{local}` form (legacy `remote_*` / `sap:*` still parsed for stored sessions).

Server: [`src/platform/remote-tools/`](../../src/platform/remote-tools/). Client helper: `createRemoteToolsHabitatAttach` in `@freeanima/shared/rpc-contract`.

## Endpoints

```text
ws://{habitat_host}:{port}/rpc/v1
http://{habitat_host}:{port}/rpc/v1/task/list
```

Helpers: `resolveHabitatRpcWsUrl`, `buildHabitatRestRequest` in `@freeanima/shared/habitat-rpc`.

## Client profiles

| Profile          | Attach                          | Typical consumer                                                |
| ---------------- | ------------------------------- | --------------------------------------------------------------- |
| Bundled SPA      | **No**                          | Chat, task, notification, diary, email                          |
| Remote-tool host | **Yes** (`remote_tools.attach`) | companion (overlay WebView-host); future independent local apps |

Bundled SPA shares **one** Habitat RPC WebSocket per page load. Product modules pass a simple `platform` channel (e.g. `"chat"`), never a remote-tool `instance_id`.

## Reconnect

Use `runHabitatRpcTransport` for connect, heartbeat, and exponential backoff. On detach or socket close, Habitat unregisters tools for that `instance_id`.

See also: [`companion.md`](../features/companion.md), [`architecture.md`](../concepts/architecture.md).
