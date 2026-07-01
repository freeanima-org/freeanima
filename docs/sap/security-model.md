---
title: SAP Security
---

# SAP Security

Hub RPC requires a **service API token** on every WebSocket `connect`. SAP attach still assumes a trusted client once transport auth succeeds.

## Trust boundary

```mermaid
flowchart TB
  subgraph trusted [Trusted client with service token]
    Hub["Hub anima service :2658"]
    RpcEndpoint["/hub/rpc/v1 WebSocket"]
    Bundled[Bundled SPA modules]
    SatA[Satellite companion]
    SatB[Satellite pair-programming]
  end
  Browser[Browser]
  Browser --> Bundled
  Browser --> SatA
  Bundled -->|"HubRPC connect + auth_token"| RpcEndpoint
  SatA -->|"HubRPC + sap.attach"| RpcEndpoint
  SatB --> RpcEndpoint
  RpcEndpoint --> Hub
```

## Current controls

| Control                       | Status                                                 |
| ----------------------------- | ------------------------------------------------------ |
| TLS on Hub RPC                | Optional; remote access via Tunnel + HTTPS/WSS         |
| Token on Hub RPC `connect`    | **Yes** — service API token (`verifyServiceApiToken`)  |
| Origin check on WebSocket     | **None**                                               |
| SAP attach for instance scope | **Yes** — `tool.*` requires `sap.attach`               |
| Session-scoped tool routing   | **Yes** — [strict routing](tools.md)                   |
| Credential values in frames   | **No** — credentials stay in pass; LLM sees paths only |

Any client that holds a valid service token and can reach `ws://127.0.0.1:2658/hub/rpc/v1` can:

- Call bundled RPC methods (chat, tasks, notifications, …) without `sap.attach`
- After `sap.attach`, register tools as the attached `app_id` / `instance_id`

Operational guidance: bind Hub to loopback; rotate service tokens; do not expose port 2658 to untrusted networks without Tunnel + Access. See [security guide](../guide/security.md).

## Protocol hardening (transport layer)

Invalid frames close the socket with **1003**. Protocol violations (double connect, RPC before connect, `tool.*` without attach) close with **1008**. Failed auth closes with **1008** (`unauthorized`).

## Future directions (not implemented)

Possible hardening items — track via GitHub Issues if prioritized:

- mTLS on `/hub/rpc/v1`
- Instance attestation tied to managed satellite systemd units
- Rate limits on connect and `tool.register`
- Explicit disconnect on missed heartbeats
