---
title: SAP Overview
---

# SAP Overview

**SAP** (Satellite Application Protocol, version `SAP/1.0`) is the WebSocket JSON protocol between the FreeAnima **Hub** (`anima service`) and **Satellite** processes. Satellites are standalone apps (Parlor, pair-programming Studio) that expose their own HTTP UI while delegating agent runtime to the Hub.

Schemas and client SDK live in [`packages/sap-contract/`](../../packages/sap-contract/). Hub server implementation: [`platform/src/sap/`](../../platform/src/sap/).

## Design goals

- **One Hub WS per instance**: each satellite instance opens exactly one `/sap/v1` connection to the Hub (multiplex sessions, streams, tools).
- **Origin isolation**: browsers load Satellite HTTP UI; Parlor and pair-programming use a local SAP relay (`/sap/relay/v1`) instead of browser-direct Hub WS.
- **Local execution**: pair-programming workspace, terminal PTY, and registered tools run on the Satellite process.
- **Shared contract**: both sides import `@freeanima/sap-contract` for envelopes, RPC types, `runSapTransport`, `createSapBrowserClient`, and `createSapRelayBrowserClient`.

## Topology

```mermaid
flowchart LR
  subgraph parlor [Parlor satellite]
    B1[Browser] -->|relay WS| Relay1["/sap/relay/v1"]
    Relay1 --> Proc1[Process SAP client]
    Proc1 -->|唯一 SAP WS| Hub
  end
  subgraph ppy [Pair-programming satellite]
    B2[Browser] -->|relay WS| Relay2["/sap/relay/v1"]
    Relay2 --> Proc2[Process SAP client]
    Proc2 -->|唯一 SAP WS| Hub
    B2 --> Local[Local FS + PTY]
  end
  Hub --> Runtime[AgentRuntime]
  subgraph hubWebUI [Hub WebUI]
    Chamber[Chamber admin]
  end
```

| Role      | Default                 | Responsibility                                   |
| --------- | ----------------------- | ------------------------------------------------ |
| Hub       | `http://127.0.0.1:2658` | Agent runtime, SAP WebSocket server at `/sap/v1` |
| Parlor    | `http://127.0.0.1:4174` | Chat UI; process gateway + relay (Type B)        |
| Pair-prog | `http://127.0.0.1:4173` | Studio UI; process gateway + relay (Type B)      |
| Chamber   | Hub `/chamber/*`        | Memory, config, tools, satellite status          |

See also: [architecture WebUI section](../concepts/architecture.md#webui).

## End-to-end happy path

```mermaid
sequenceDiagram
  participant Sat as Satellite process
  participant Hub as Hub
  participant Agent as AgentRuntime

  Sat->>Hub: connect
  Hub->>Sat: connected
  Sat->>Hub: req tool.register
  Hub->>Sat: res ok
  Sat->>Hub: req session.create
  Hub->>Sat: res session_id
  Sat->>Hub: req message.send
  Hub->>Sat: res stream_id
  Hub-->>Sat: evt stream.accepted
  Hub-->>Sat: evt stream.token
  Agent->>Hub: invoke sap tool
  Hub-->>Sat: evt tool.call
  Sat->>Hub: req tool.result
  Hub-->>Sat: evt stream.tool_result
  Hub-->>Sat: evt stream.done
```

1. Satellite process opens `ws://{hub}/sap/v1` and sends `connect`.
2. Hub replies `connected` and registers the instance in `SatelliteManager`.
3. Satellite registers local tools via `tool.register`.
4. UI traffic (Type B) goes Browser → `/sap/relay/v1` → same process SAP client.
5. `message.send` returns a `stream_id`; Hub pushes `stream.*` events (fan-out on relay).
6. When the agent calls a Satellite tool, Hub sends `tool.call`; Satellite replies with `tool.result` or `tool.error`.

## Document map

| Topic                           | File                                     |
| ------------------------------- | ---------------------------------------- |
| Transport, envelopes, heartbeat | [transport.md](transport.md)             |
| RPC methods                     | [methods.md](methods.md)                 |
| Async events                    | [events.md](events.md)                   |
| Tool naming and routing         | [tools.md](tools.md)                     |
| Config and implementation       | [satellite-guide.md](satellite-guide.md) |
| Security model                  | [security-model.md](security-model.md)   |
