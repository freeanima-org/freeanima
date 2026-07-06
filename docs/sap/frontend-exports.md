---
title: Frontend Exports
---

# Frontend three-tier export convention

Embeddable frontend content packs register via **manifest / desktop / mobile** exports.

The unified settings window is aggregated by the registry in [`src/frontend/shell-ui/`](../../src/frontend/shell-ui/); contract in [`src/frontend/shell-ui/lib/settings.ts`](../../src/frontend/shell-ui/lib/settings.ts) (unrelated to SAP).

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

Implementation SSOT: [`src/frontend/shell-sdk/manifest.ts`](../../src/frontend/shell-sdk/manifest.ts)

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
| `@freeanima/feature-chat`        | `chat`      | `bundled-spa`       |
| `@freeanima/feature-console`     | `console`   | `bundled-spa`       |

Shell apps: [`src/app/shell/desktop/`](../../src/app/shell/desktop/) · [`src/app/shell/mobile/`](../../src/app/shell/mobile/) · [`src/app/shell/web/`](../../src/app/shell/web/) · [`src/frontend/shell-ui/`](../../src/frontend/shell-ui/)

## Chat: Hub RPC and instance_id

Bundled chat uses [`createSapDirectClient`](../../src/shared/sap-contract/direct-client.ts) on the shared Hub RPC transport (`getBundledHubRpcClient` / `whenHubRpcReady`). It does **not** call `sap.attach`.

`instance_id` persistence:

- Electron shell: preload provides `createFileInstanceStore("chat")` → `~/.anima/satellites/chat/instance.json`
- Capacitor: Preferences

## Console: Hub REST + bundled SPA

Console UI source SSOT: [`src/features/console/ui/console/`](../../src/features/console/ui/console/). Build helpers: [`src/features/console/build/`](../../src/features/console/build/)（Paraglide compile、admin hash）；SPA 打包进 desktop / mobile / web shell。

REST base: bundled pages use `window.satelliteShell.hubUrl` for Hub **`/api/*`**. Hub enables CORS for localhost / Capacitor origins.

Local shell dev: `bun run dev:web` → `http://127.0.0.1:4173` (Hub must be running; includes Chat, Console, settings).
