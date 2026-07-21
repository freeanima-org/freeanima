---
title: Frontend Exports
---

# Frontend three-tier export convention

Embeddable frontend content packs register via **manifest / desktop / mobile** exports.

The unified settings window is aggregated by the registry in [`src/frontend/shell-ui/`](../../src/frontend/shell-ui/); contract in [`src/frontend/shell-ui/lib/settings.ts`](../../src/frontend/shell-ui/lib/settings.ts) (unrelated to SAP).

## Manifest (required)

Path: `./manifest` — JSON-serializable metadata.

| Field             | Description                                         |
| ----------------- | --------------------------------------------------- |
| `appId`           | Application id                                      |
| `displayName`     | Display name                                        |
| `version`         | Version (usually synced with monorepo root package) |
| `supportsDesktop` | Supports desktop embed                              |
| `supportsMobile`  | Supports mobile embed                               |
| `sap`             | Optional; true when pack needs SAP attach / tools   |

Implementation SSOT: [`src/frontend/shell-sdk/manifest.ts`](../../src/frontend/shell-sdk/manifest.ts)

## Desktop / Mobile profile

- `./desktop` — desktop shell compile-time import profile (window spec, launch mode)
- `./mobile` — mobile profile; when unsupported, `embedMode: "unsupported"`

### `embedMode`

| Value              | Represents                       | In-process host?                         |
| ------------------ | -------------------------------- | ---------------------------------------- |
| `embedded-sidecar` | companion (VRM + tools)          | **Yes** (literal name = in-process host) |
| `bundled-spa`      | shell-ui module (chat, admin, …) | **No**                                   |
| `unsupported`      | mobile profile placeholder       | —                                        |

`embedMode: "embedded-sidecar"` means the shell hosts an **in-process** companion host (static HTTP + SAP attach in Electron main), **not** a separate Node child process.

`embedMode` describes **how the shell hosts the UI**, not which Habitat wire the module uses at runtime (Habitat RPC vs attach).

Bundled SPA: Habitat provides `/rpc/v1` (and legacy `/api` where still mapped).

## Current frontend packages

| Package                          | appId       | embedMode (profile) |
| -------------------------------- | ----------- | ------------------- |
| `@freeanima/satellite-companion` | `companion` | `embedded-sidecar`  |
| `@freeanima/feature-chat`        | `chat`      | `bundled-spa`       |
| `@freeanima/feature-habitat`     | `console`   | `bundled-spa`       |

Shell apps: [`src/app/shell/desktop/`](../../src/app/shell/desktop/) · [`src/app/shell/mobile/`](../../src/app/shell/mobile/) · [`src/app/shell/web/`](../../src/app/shell/web/) · [`src/frontend/shell-ui/`](../../src/frontend/shell-ui/)

## Chat: Habitat RPC

Bundled chat uses [`getBundledSapStreamClient`](../../src/shared/sap-contract/bundled-sap-stream.ts) on the shared Habitat RPC transport (`getBundledHabitatRpcClient` / `whenHabitatRpcReady`). It does **not** call `sap.attach`.

Optional `instance_id` file stores under shell prefs are **not** SAP attach ids for chat.

## Habitat: Habitat RPC + bundled SPA

Habitat UI source SSOT: [`src/features/habitat/ui/habitat/`](../../src/features/habitat/ui/habitat/). Build helpers: [`src/features/habitat/build/`](../../src/features/habitat/build/); SPA 打包进 desktop / mobile / web shell。

REST base: bundled pages use `window.satelliteShell.hubUrl` for Habitat RPC REST **`/rpc/v1/*`** (or `hub().call("method")`). Habitat enables CORS for localhost / Capacitor origins.

Local shell dev: `bun run dev:web` → `http://127.0.0.1:4173` (Habitat must be running; includes Chat, Habitat, settings).
