---
title: Desktop Companion
---

# Desktop Companion

> **Dynamic SAP satellite**: a standalone desktop GUI app, not managed via `config.yaml`.

The desktop companion is a SAP **Type B** app (embedded sidecar holds the Hub WebSocket, `relay: false`): the **content pack** (React + VRM + Node sidecar) is embedded by the **desktop shell** (`src/app/shell/desktop`), registers with the Hub via SAP, and exposes local tools to the Agent.

## Architecture

```text
FreeAnima Desktop (src/app/shell/desktop)
├── Electron Main — tray / multi-window + embedded companion sidecar
│   ├── companion overlay — transparent always-on-top, VRM / speech bubble
│   ├── companion settings — settings window (Hub RPC + asset HTTP)
│   ├── chat — Chat SPA (SAP direct, no sidecar)
│   └── console — Console WebView (Hub REST)
└── Renderer — preload satelliteShell; companion visibility via IPC
         ↕ SAP WS + Hub RPC
    anima service Hub (companion_profile SSOT + assets + FBX→VRMA)
```

### Hub vs local boundary

| Layer            | Location                             | Responsibility                                                                                                                                                           |
| ---------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Hub SSOT**     | `src/features/companion/`            | `companion_profile` entity (behavior, slots, library meta); VRM/VRMA files under `~/.anima/companion/` on Hub host; FBX→VRMA conversion; Settings read/write via Hub RPC |
| **Settings UI**  | Desktop Settings → Companion section | Hub RPC (`companion.config.*`, model/motion CRUD); upload via `POST /api/companion/models/upload` and `/motions/import`                                                  |
| **Thin sidecar** | `src/satellites/companion/server/`   | SAP attach, `bubble` / `play_slot`, runtime WebSocket, local asset cache; startup `companion.sync.pull`                                                                  |
| **Electron**     | `src/app/shell/desktop/`             | Transparent window, click-through, tray, companion show/hide IPC                                                                                                         |

Management is in **Settings only** — Console has no companion admin page.

On sidecar start: Hub config wins; `~/.anima/companion/config.json` on the desktop is an **offline cache**. Legacy local data is migrated once to Hub (`companion.migrate.fromLocal` or HTTP upload). Multiple desktops share the same model/motion library via Hub.

```text
Settings ──Hub RPC/HTTP──► features/companion (Hub)
Sidecar  ◄──sync.pull────► Hub          ──► local cache (VRM/VRMA)
Overlay  ◄──localhost────► Sidecar       (runtime WS + /api/config)
Electron ◄──IPC──────────► Settings       (show/hide only)
Agent    ──SAP───────────► Sidecar        (bubble, play_slot)
```

The content pack lives in [`src/satellites/companion/`](../../src/satellites/companion/) (`spa/` + thin `server/` + `shared/`). Hub domain logic: [`src/features/companion/`](../../src/features/companion/). Export conventions: [`frontend-exports.md`](../sap/frontend-exports.md).

Compared with Chat / pair programming:

|             | Chat / pair programming              | Companion                                            |
| ----------- | ------------------------------------ | ---------------------------------------------------- |
| UI          | Browser Web UI                       | Native transparent companion window + settings       |
| Deployment  | Managed (can co-locate with service) | Dynamic (user starts manually)                       |
| SAP         | Type A or Type B + relay             | Type B + tools, no relay                             |
| Client & UI | Can be separated                     | Companion render and settings share one Electron app |

## Features

- VRM avatar rendering (Three.js + `@pixiv/three-vrm`); VRM 1.0 and 0.x auto orientation correction
- **Motion slots**: five slots — `idle`, `rest`, `walk`, `climb`, `in_place`; each slot binds 0..n VRMA clips; play by id or random; empty slot = no animation
- **Speech bubble**: one-way text queue; user click advances; no auto-dismiss; pushed by Hub Agent via `companion.bubble` tool
- Transparent always-on-top companion window (160×260); avatar area clickable, empty area click-through
- **Local interaction**: drag to move window; click body to play random motion from `in_place` slot
- **Patrol** (Settings → Behavior tab): idle patrol, double-click patrol, corner pause, patrol speed, return-to-start on launch, etc.
- System tray: show/hide companion, **Settings…** (open settings window), quit
- Settings tabs: **General** / **Behavior** / **Models** / **Motion slots** / **Motion library**

## Agent tools (sidecar registration)

| Tool        | Parameters                           | Description                            |
| ----------- | ------------------------------------ | -------------------------------------- |
| `bubble`    | `text: string`                       | Enqueue text in speech bubble          |
| `play_slot` | `slot: string`; `motion_id?: string` | Play motion slot; `motion_id` optional |

Periodic content (e.g. scheduled jokes) is configured on **anima service / scheduled tasks**; the Agent calls `bubble`. Companion has no built-in timer.

## Models and motions

The repo **does not bundle** `.vrm` / `.vrma` files. **Hub** is the SSOT: `companion_profile` entity in PostgreSQL plus files on the Hub host at `~/.anima/companion/models/` and `motions/`. Each desktop keeps a **local cache** synced on sidecar start (`companion.sync.pull`).

### VRM models

Settings → **Models** tab: list, import, delete, rename, switch current model. Upload goes to Hub (`POST /api/companion/models/upload`); sidecar downloads missing files for overlay rendering.

During development, files in `src/satellites/companion/public/models/` serve as fallback.

### VRMA library and slots

Settings → **Motion library** tab: import VRMA, FBX, or ZIP (FBX is converted on **Hub**, not on desktop). **Motion slots** tab assigns motions per slot. Preview supports mouse drag to rotate view.

Unbound slots play no animation; patrol still moves the window; walk/climb VRMA play only when bound.

### FBX import

FBX→VRMA runs on the **Hub host** (`anima service`). Desktop installers no longer bundle `fbx2vrma-converter` or FBX2glTF. On the Hub machine run `bun run setup:fbx` if FBX conversion is needed.

## Development and run

### Browser dev (no Electron)

In `src/satellites/companion`:

```bash
bun run dev
# or bun src/satellites/companion/dev.ts
```

- Companion: http://127.0.0.1:4176
- Settings (browser dev): http://127.0.0.1:4176/?view=settings

In the Electron desktop shell, open settings via tray → **Settings…**; the overlay has no settings button.

### Electron desktop shell (companion + Chat + Console)

```bash
# 从仓库根目录
bun run dev:windows
```

Packaging (Linux cross-build for Windows):

```bash
# Daily: portable win-unpacked (~20s; copy exe to Windows)
bun run dev:windows

# Installer / install-flow test (NSIS, ~2min+)
bun run package:windows
```

Or from repository root: `bun run dev:windows` / `bun run package:windows`. Fast path keeps `vendor/` and `release/` for incremental builds; full clean: `DESKTOP_SHELL_CLEAN=1`.

Environment variables:

| Variable                 | Default                 | Description                                     |
| ------------------------ | ----------------------- | ----------------------------------------------- |
| `FREEANIMA_URL`          | `http://127.0.0.1:2658` | Hub fallback when no desktop `settings.json`    |
| `SATELLITE_PORT`         | `4176`                  | Local HTTP port                                 |
| `COMPANION_VRMA_ZIP_URL` | (empty)                 | Optional direct zip mirror; downloaded on start |

Hub URL and remote token are managed by the desktop shell in **`~/.anima-desktop/settings.json`** (`hub` section; tray → **Hub settings…**). Companion Settings → General tab shows Hub URL read-only.

Hub assigns a **3-character** `instance_id` on first `connect`, stored in `~/.anima/companion/instance.json` (not under `src/satellites/`).

### Troubleshooting

| Symptom                  | Action                                                                                            |
| ------------------------ | ------------------------------------------------------------------------------------------------- |
| Double-click, no window  | Check system tray; tray → **Settings…** → import `.vrm`                                           |
| Click, no motion         | Settings → **Motion library** import VRMA; **Motion slots** bind slot                             |
| Cannot reach Hub         | Confirm `anima service` and Hub settings token (`fa_at_...`); tray **Hub settings** URL and token |
| Import has no effect     | Hot reload after import; confirm slot has motion checked                                          |
| Background service fails | See `~/.anima/desktop-shell/shell.log`; confirm ports 4176–4185 free                              |
| FBX import unavailable   | Run `bun run setup:fbx` on the **Hub host** (not the desktop installer)                           |

## Related docs

- SAP satellite guide: [`satellite-guide.md`](../sap/satellite-guide.md)
- SAP security model: [`security-model.md`](../sap/security-model.md)
