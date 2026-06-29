---
title: Frontend Exports
---

# Frontend three-tier export convention

Embeddable frontend content packs register via **manifest / desktop / mobile** exports.

The unified settings window is aggregated by the registry in [`packages/shell-ui/`](../../packages/shell-ui/); contract in [`packages/shell-ui/src/settings.ts`](../../packages/shell-ui/src/settings.ts) (unrelated to SAP).

## Manifest (required)

Path: `./manifest` — JSON-serializable metadata.

| Field             | Description                                         |
| ----------------- | --------------------------------------------------- |
| `appId`           | Application id                                      |
| `displayName`     | Display name                                        |
| `version`         | Version (usually synced with monorepo root package) |
| `supportsDesktop` | Supports desktop embed                              |
| `supportsMobile`  | Supports mobile embed                               |
| `connectionKind`  | See table below                                     |
| `sap`             | Optional; SAP satellites only                       |

### connectionKind

| Value              | Represents                | Sidecar required?                   |
| ------------------ | ------------------------- | ----------------------------------- |
| `embedded-sidecar` | companion (VRM + tools)   | **Yes** (embedded in same process)  |
| `sap-direct`       | chat (renderer → Hub SAP) | **No** (persist `instance_id` only) |
| `hub-rest`         | Admin console (Hub REST)  | **No**                              |

Implementation SSOT: [`packages/satellite-sdk/src/manifest.ts`](../../packages/satellite-sdk/src/manifest.ts)

## Desktop / Mobile (optional)

- `./desktop` — desktop shell compile-time import profile (window spec, launch mode)
- `./mobile` — mobile profile; when unsupported, `embedMode: "unsupported"`

`embedMode: "bundled-spa"` — UI bundled in client install; Hub provides `/api` and `/sap/v1` only.

## Current frontend packages

| Package                          | appId       | connectionKind     | embedMode     |
| -------------------------------- | ----------- | ------------------ | ------------- |
| `@freeanima/satellite-companion` | `companion` | `embedded-sidecar` | sidecar       |
| `@freeanima/satellite-chat`      | `chat`      | `sap-direct`       | `bundled-spa` |
| Admin (`app/desktop` profile)    | `admin`     | `hub-rest`         | `bundled-spa` |

Shell apps: [`app/desktop/`](../../app/desktop/) · [`app/mobile/`](../../app/mobile/) · [`packages/shell-ui/`](../../packages/shell-ui/)

## Chat: SAP direct and instance_id

Desktop/mobile chat uses [`createSapDirectClient`](../../packages/sap-contract/src/direct-client.ts) to connect to Hub `/sap/v1`.

`instance_id` persistence:

- Electron shell: preload provides `createFileInstanceStore("chat")` → `~/.anima/satellites/chat/instance.json`
- Capacitor: Preferences

## Admin: Hub REST + bundled SPA

Admin UI is built by [`@freeanima/admin-frontend`](../../platform/admin-frontend/) and bundled into desktop / mobile.

REST base: bundled pages use `window.satelliteShell.hubUrl` for Hub **`/api/*`**. Hub enables CORS for localhost / Capacitor origins.

Local shell dev: `bun run dev:web` → `http://127.0.0.1:4173` (Hub must be running; includes Chat, Admin, settings).
