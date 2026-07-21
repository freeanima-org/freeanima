---
title: Desktop Companion
---

# Desktop Companion

> **remote-tools attach host** embedded in the desktop Portal (Electron main) — not managed via `config.yaml`, and **not** a separate Node sidecar process.

The content pack (React + VRM + in-process host) is embedded by the **desktop shell** (`src/app/shell/desktop`), connects with Habitat RPC, calls `remote_tools.attach`, and exposes local tools (`bubble`, `play_slot`) to the Agent. Product modules such as Chat use Habitat RPC only (no attach).

## Architecture

```text
FreeAnima Desktop (src/app/shell/desktop)
├── Electron Main — tray / multi-window + in-process companion host
│   ├── companion overlay — transparent always-on-top, VRM / speech bubble
│   ├── companion settings — settings window (Habitat RPC + asset HTTP)
│   ├── chat — Chat SPA (Habitat RPC, no remote_tools.attach)
│   └── console — Habitat WebView (Habitat RPC REST)
└── Renderer — preload satelliteShell; companion visibility + runtime via IPC
         ↕ Habitat RPC (+ remote_tools.attach on host only)
    anima service Habitat (companion_profile SSOT + assets + FBX→VRMA)
```

### Habitat vs local boundary

| Layer              | Location                           | Responsibility                                                                                                                                                                   |
| ------------------ | ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Habitat SSOT**   | `src/features/companion/`          | `companion_profile` entity (behavior, slots, library meta); VRM/VRMA files under `~/.anima/companion/` on Habitat host; FBX→VRMA conversion; Settings read/write via Habitat RPC |
| **Settings UI**    | Desktop Settings → Companion       | Habitat RPC (`companion.config.*`, model/motion CRUD); upload via `POST /rpc/v1/companion/model/upload` and `/companion/motion/import`                                           |
| **Companion host** | `src/satellites/companion/server/` | Same process as Electron main: `remote_tools.attach`, tools, local asset cache, `companion.sync.pull`; Electron IPC for runtime; HTTP for static assets                          |
| **Electron**       | `src/app/shell/desktop/`           | Transparent window, click-through, tray, show/hide + runtime IPC                                                                                                                 |

Management is in **Settings only** — Habitat has no companion admin page.

On host start: Habitat config wins; `~/.anima/companion/config.json` on the desktop is an **offline cache**. Legacy local data is migrated once to Habitat (`companion.migrate.fromLocal` or HTTP upload). Multiple desktops share the same model/motion library via Habitat.

```text
Settings ──Habitat RPC/HTTP──► features/companion (Habitat)
Host     ◄──sync.pull────► Habitat          ──► local cache (VRM/VRMA)
Overlay  ◄──IPC runtime──► Host             (+ HTTP for /models /motions)
Electron ◄──IPC──────────► Settings         (show/hide, connection)
Agent    ──Habitat RPC tool.call─► Host             (bubble, play_slot)
```

The content pack lives in [`src/satellites/companion/`](../../src/satellites/companion/) (`spa/` + `server/` + `shared/`). Habitat domain logic: [`src/features/companion/`](../../src/features/companion/). Export conventions: [`frontend-exports.md`](../sap/frontend-exports.md).

|              | Chat / other product modules | Companion                                        |
| ------------ | ---------------------------- | ------------------------------------------------ |
| UI           | Browser / shell Web UI       | Native transparent companion window + settings   |
| Deployment   | Bundled in shell             | Dynamic attach when Habitat token is configured  |
| Wire         | Habitat RPC only (no attach) | Habitat RPC + `remote_tools.attach` + tools      |
| Runtime push | —                            | Electron IPC (browser-dev: localhost runtime WS) |

## Features

- VRM avatar rendering (Three.js + `@pixiv/three-vrm`); VRM 1.0 and 0.x auto orientation correction
- **Motion slots**: five slots — `idle`, `rest`, `walk`, `climb`, `in_place`; each slot binds 0..n VRMA clips; play by id or random; empty slot = no animation
- **Speech bubble**: one-way text queue; user click advances; no auto-dismiss; pushed by Habitat Agent via companion `bubble` tool
- Transparent always-on-top companion window (160×260); avatar area clickable, empty area click-through
- **Local interaction**: drag to move window; click body to play random motion from `in_place` slot
- **Patrol** (Settings → Behavior tab): idle patrol, double-click patrol, corner pause, patrol speed, return-to-start on launch, etc.
- System tray: show/hide companion, **Settings…** (open settings window), quit
- Settings tabs: **General** / **Behavior** / **Models** / **Motion slots** / **Motion library**

## Agent tools (host registration)

| Tool        | Parameters                           | Description                            |
| ----------- | ------------------------------------ | -------------------------------------- |
| `bubble`    | `text: string`                       | Enqueue text in speech bubble          |
| `play_slot` | `slot: string`; `motion_id?: string` | Play motion slot; `motion_id` optional |

Periodic content (e.g. scheduled jokes) is configured on **anima service / scheduled tasks**; the Agent calls `bubble`. Companion has no built-in timer.

Settings → Companion client section shows **instance id** and **remote tools connected** (`remote_tools_connected` from host `/api/config`). Without a Habitat API token, attach is skipped until connection settings are saved.

## Models and motions

The repo **does not bundle** `.vrm` / `.vrma` files. **Habitat** is the SSOT: `companion_profile` entity in PostgreSQL plus files on the Habitat host at `~/.anima/companion/models/` and `motions/`. Each desktop keeps a **local cache** synced on host start (`companion.sync.pull`).

### VRM models

Settings → **Models** tab: list, import, delete, rename, switch current model. Upload goes to Habitat (`POST /rpc/v1/companion/model/upload`); host downloads missing files for overlay rendering.

During development, files in `src/satellites/companion/public/models/` serve as fallback.

### VRMA library and slots

Settings → **Motion library** tab: import VRMA, FBX, or ZIP (FBX is converted on **Habitat**, not on desktop). **Motion slots** tab assigns motions per slot. Preview supports mouse drag to rotate view.

Unbound slots play no animation; patrol still moves the window; walk/climb VRMA play only when bound.

### FBX import

FBX→VRMA runs on the **Habitat host** (`anima service`). Desktop installers no longer bundle `fbx2vrma-converter` or FBX2glTF. On the Habitat machine run `bun run setup:fbx` if FBX conversion is needed.

## Development and run

### Browser dev (no Electron)

```bash
bun run --filter @freeanima/satellite-companion dev
# or: bun src/satellites/companion/dev.ts
```

Uses the same in-process HTTP server; runtime events use localhost WebSocket (`/api/runtime/ws`).

### Desktop (Electron)

Desktop shell starts the companion host in-process (`startCompanionServer`) and loads the overlay from the host HTTP origin. Runtime events use Electron IPC (`companion:runtime`).

See also: [Habitat RPC](../guide/habitat-rpc.md), [architecture companion section](../concepts/architecture.md#desktop-companion-habitat-ssot).
