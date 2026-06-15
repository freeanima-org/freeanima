---
title: Satellite Guide
---

# Satellite Guide

How to run, configure, and implement a Satellite app that speaks SAP.

## Deployment modes

Hub learns about Satellites in two ways:

### Managed (config + systemd)

Declare a process in `~/.anima/config.yaml`. `anima service start/stop/restart` writes `anima-satellite-<name>.service` user units (when systemd is available) and starts/stops them with `anima.service`.

```yaml
satellites:
  parlor:
    enabled: true
    command: bun
    args: ["satellites/parlor/dev.ts"]
    env:
      SATELLITE_PORT: "4174"
  pair-programming:
    enabled: true
    command: bun
    args: ["satellites/pair-programming/dev.ts"]
    env:
      STUDIO_WORKSPACE: /path/to/project
      SATELLITE_PORT: "4173"
```

| Field              | Role                                             |
| ------------------ | ------------------------------------------------ |
| `command` / `args` | Process to run (required for managed satellites) |
| `env`              | Extra environment variables                      |

Working directory is derived by anima from the install layout (monorepo root or CLI package root), not configured here.

**Startup:** managed satellites start only after Hub `GET /api/health` returns `status: ok`.

See [service.md](../guide/service.md) for systemd unit paths and startup order.

### Dynamic (SAP connect)

No `command` in config. Start the satellite yourself; it connects to Hub via SAP WebSocket. Instances appear on Chamber → Satellites after connect.

There is **no** global `studio:` section in `config.yaml`.

Open managed satellite UI at the URL from Chamber (SAP `http_url`), typically:

- Parlor: `http://127.0.0.1:4174`
- Pair-programming: `http://127.0.0.1:4173`

## Satellite access modes

**Rule:** each `app_id + instance_id` has **at most one** Hub WebSocket (`/sap/v1`).

### Type A — Browser-direct (Parlor)

- Browser `createSapBrowserClient` → Hub `/sap/v1` (this is the instance's only Hub WS).
- Satellite HTTP serves static UI + `/config.json` only.
- **Limits:** no `tool.register` or local workspace tools; browser must reach Hub on the LAN; multiple tabs share one `instance_id` (last connect wins in Hub today).

### Type B — Process gateway + local relay (pair-programming)

- Satellite **process** holds the sole Hub WS via `runSapTransport`.
- Browser uses `createSapRelayBrowserClient` → satellite `/sap/relay/v1` (SAP frame pass-through, **not** REST hub-api).
- Local FS/terminal stay on satellite HTTP/WS; agent tools run in the process via `tool.register`.

```mermaid
flowchart TB
  subgraph parlor [Parlor Type A]
    B1[Browser] -->|唯一 SAP WS| Hub1[Hub]
    S1[静态 server] -.->|/config.json| B1
  end

  subgraph ppy [Pair-programming Type B]
    B2[Browser] -->|relay WS| Relay["/sap/relay/v1"]
    Relay --> ProcSAP[runSapTransport]
    ProcSAP -->|唯一 SAP WS| Hub2[Hub]
    B2 --> LocalFS["/api/studio/*"]
    B2 --> LocalPTY[本地 terminal WS]
    ProcSAP --> ToolExec[tool executor]
  end
```

**Deprecated:** HTTP hub-api REST→SAP proxy (removed).

### Parlor satellite

Browser connects to Hub via SAP WebSocket from the client ([`browser-client.ts`](../../packages/sap-contract/src/browser-client.ts)); static server only serves UI + `/config.json`.

### Pair-programming satellite

Browser connects to [`/sap/relay/v1`](../../satellites/pair-programming/server/sap/relay.ts); the process multiplexes session/stream/tool traffic on one Hub WS. Terminal PTY runs locally ([`terminal-session.ts`](../../satellites/pair-programming/server/terminal-session.ts)).

Reference files:

- [`satellites/pair-programming/server/sap/hub.ts`](../../satellites/pair-programming/server/sap/hub.ts)
- [`satellites/pair-programming/server/sap/relay.ts`](../../satellites/pair-programming/server/sap/relay.ts)
- [`packages/sap-contract/src/relay-browser-client.ts`](../../packages/sap-contract/src/relay-browser-client.ts)
- [`satellites/pair-programming/server/http/terminal-bridge.ts`](../../satellites/pair-programming/server/http/terminal-bridge.ts)

## Minimal SAP client

Use `runSapTransport` from `@freeanima/sap-contract`:

```typescript
import { runSapTransport } from "@freeanima/sap-contract";

const transport = runSapTransport({
  hubUrl: process.env.FREEANIMA_URL ?? "http://127.0.0.1:2658",
  connect: {
    app_id: "my-app",
    instance_id: process.env.SATELLITE_INSTANCE_ID ?? crypto.randomUUID(),
    features_requested: ["server_info", "capability_mask"],
    http_url: `http://127.0.0.1:${process.env.SATELLITE_PORT ?? 4173}`,
  },
  onConnected: async (client) => {
    client.onEvent("tool.call", (payload) => {
      /* handle */
    });
    await client.request("tool.register", {
      tools: [
        /* ... */
      ],
    });
  },
});
```

Browser UI on Type B satellites uses `createSapRelayBrowserClient()` instead of talking to Hub directly.

Transport handles WebSocket open, `connect` handshake, heartbeat, and reconnect with exponential backoff.

## Environment variables

| Variable                                  | Role                                           |
| ----------------------------------------- | ---------------------------------------------- |
| `FREEANIMA_URL`                           | Hub HTTP base URL                              |
| `SATELLITE_PORT`                          | Satellite HTTP listen port                     |
| `SATELLITE_INSTANCE_ID`                   | Stable instance id (optional; random if unset) |
| `STUDIO_WORKSPACE`                        | Pair-programming workspace root                |
| `STUDIO_GITIGNORE` / `STUDIO_SHOW_HIDDEN` | File tree filters                              |

## Layer dependencies

Per [`scripts/check-layer-deps.ts`](../../scripts/check-layer-deps.ts): `satellites/*` may depend only on `@freeanima/sap-contract` and `@freeanima/kernel`. Do not import platform or runtime packages from Satellite code.

## Chamber visibility

`GET /api/satellites/status` (Chamber → Satellites) reads `SatelliteManager.getStatus()`: connected instances, `http_url`, registered tools, heartbeat timestamps.

## Further reading

- [overview.md](overview.md) — protocol goals
- [transport.md](transport.md) — envelopes and handshake
- [tools.md](tools.md) — tool registration and routing
- [pair-programming v1](../features/pair-programming-v1.md) — Studio product docs
