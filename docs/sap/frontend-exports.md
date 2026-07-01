---
title: Frontend Exports
---

# Frontend three-tier export convention

Embeddable frontend content packs register via **manifest / desktop / mobile** exports.

The unified settings window is aggregated by the registry in [`packages/shell-ui/`](../../packages/shell-ui/); contract in [`packages/shell-ui/src/settings.ts`](../../packages/shell-ui/src/settings.ts) (unrelated to SAP).

## Manifest (required)

Path: `./manifest` — JSON-serializable metadata.

| Field             | Description                                          |
| ----------------- | ---------------------------------------------------- |
| `appId`           | Application id                                       |
| `displayName`     | Display name                                         |
| `version`         | Version (usually synced with monorepo root package)  |
| `supportsDesktop` | Supports desktop embed                               |
| `supportsMobile`  | Supports mobile embed                                |
| `sap`             | Optional; true satellite metadata (`relay`, `tools`) |

Implementation SSOT: [`packages/shell-sdk/src/manifest.ts`](../../packages/shell-sdk/src/manifest.ts)

## Desktop / Mobile profile

- `./desktop` — desktop shell compile-time import profile (window spec, launch mode)
- `./mobile` — mobile profile; when unsupported, `embedMode: "unsupported"`

### `embedMode`

| Value              | Represents                       | Sidecar required?                  |
| ------------------ | -------------------------------- | ---------------------------------- |
| `embedded-sidecar` | companion (VRM + tools)          | **Yes** (embedded in same process) |
| `bundled-spa`      | shell-ui module (chat, admin, …) | **No**                             |
| `unsupported`      | mobile profile placeholder       | —                                  |

`embedMode` describes **how the shell hosts the UI**, not which Hub wire the module uses at runtime (that is determined by module code: Hub RPC vs REST).

Bundled SPA: Hub provides `/api` and `/hub/rpc/v1`.

## Current frontend packages

| Package                          | appId       | embedMode (profile) |
| -------------------------------- | ----------- | ------------------- |
| `@freeanima/satellite-companion` | `companion` | `embedded-sidecar`  |
| `@freeanima/satellite-chat`      | `chat`      | `bundled-spa`       |
| Admin (`app/desktop` profile)    | `admin`     | `bundled-spa`       |

Shell apps: [`app/desktop/`](../../app/desktop/) · [`app/mobile/`](../../app/mobile/) · [`packages/shell-ui/`](../../packages/shell-ui/)

## Chat: Hub RPC and instance_id

Bundled chat uses [`createSapDirectClient`](../../packages/sap-contract/src/direct-client.ts) on the shared Hub RPC transport (`getBundledHubRpcClient` / `whenHubRpcReady`). It does **not** call `sap.attach`.

`instance_id` persistence:

- Electron shell: preload provides `createFileInstanceStore("chat")` → `~/.anima/satellites/chat/instance.json`
- Capacitor: Preferences

## Admin: Hub REST + bundled SPA

Admin UI is built by [`@freeanima/admin-frontend`](../../platform/admin-frontend/) and bundled into desktop / mobile.

REST base: bundled pages use `window.satelliteShell.hubUrl` for Hub **`/api/*`**. Hub enables CORS for localhost / Capacitor origins.

Local shell dev: `bun run dev:web` → `http://127.0.0.1:4173` (Hub must be running; includes Chat, Admin, settings).
