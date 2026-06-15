---
title: Satellites
---

# Satellites

Satellite apps (e.g. pair-programming) are separate processes. Hub learns about them in two ways:

## Managed (config + systemd)

Declare a process in `~/.anima/config.yaml`. `anima service start/stop/restart` writes `anima-satellite-<name>.service` user units (when systemd is available) and starts/stops them with `anima.service`.

```yaml
satellites:
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

Pair-programming env conventions: `STUDIO_WORKSPACE`, optional `STUDIO_GITIGNORE`, `STUDIO_SHOW_HIDDEN`, `SATELLITE_PORT`.

**Startup:** managed satellites start only after Hub `GET /api/health` returns `status: ok` (not when you first open the satellite UI).

**SAP:** satellite processes use `@freeanima/sap-contract` `runSapTransport` for WebSocket connect and reconnect with backoff; register tools in `onConnected`.

## Dynamic (SAP connect)

No `command` in config. Start the satellite yourself (terminal, your own unit, etc.); it connects to Hub via SAP WebSocket. Instances appear on Chamber → Satellites after connect.

There is **no** global `studio:` section in `config.yaml`.

Open managed satellite UI at the URL from Chamber (SAP `http_url`), typically `http://127.0.0.1:4173`.
