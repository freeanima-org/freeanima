---
title: Desktop Companion
---

# Desktop Companion

> **Outpost** (前哨): **remote-tools attach host** in the Companion **overlay WebView** (first-party) — embedded by the desktop Portal shell for window/IPC/FS only. Target shell: **Tauri**（见 [`.agent/rules/tauri-shell.md`](../../.agent/rules/tauri-shell.md)）。Not managed via `config.yaml`, and **not** a separate Node sidecar process.

The content pack (React + VRM) is embedded by the **desktop Tauri shell** (`src/app/shell/tauri`). Packaged overlay loads from `frontendDist` `ui/companion/` via `WebviewUrl::App` (same custom protocol as the main window — **not** `file://` resources). The overlay connects with Habitat RPC, calls `remote_tools.attach`, and exposes local tools (`bubble`, `play_slot`) to the Agent. Product modules such as Chat use Habitat RPC only (no attach).

## Architecture

```text
FreeAnima Portal (src/app/shell/tauri)
├── Tauri (Rust) — tray / multi-window + prefs / IPC
│   ├── companion overlay — work-area fullscreen transparent; VRM stage + remote_tools.attach
│   ├── companion settings — settings in main window (Habitat RPC + asset HTTP)
│   ├── chat — Chat SPA (Habitat RPC, no remote_tools.attach)
│   └── habitat — Habitat WebView (Habitat RPC REST)
└── Renderer — portalShell; overlay owns attach + tool runtime
         ↕ Habitat RPC (+ remote_tools.attach in overlay only)
    anima service Habitat (companion_profile SSOT + assets + FBX→VRMA)
```

### Habitat vs local boundary

| Layer              | Location                     | Responsibility                                                                                                                                                                   |
| ------------------ | ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Habitat SSOT**   | `src/features/companion/`    | `companion_profile` entity (behavior, slots, library meta); VRM/VRMA files under `~/.anima/companion/` on Habitat host; FBX→VRMA conversion; Settings read/write via Habitat RPC |
| **Settings UI**    | Desktop Settings → Companion | Habitat RPC (`companion.config.*`, model/motion CRUD); upload via `POST /rpc/v1/companion/model/upload` and `/companion/motion/import`                                           |
| **Companion host** | overlay SPA (`spa/`)         | `remote_tools.attach`, tool execution, local runtime (bubble/play); optional thin HTTP for static assets + `companion.sync.pull` cache                                           |
| **Tauri host**     | `src/app/shell/tauri/`       | Transparent window, click-through, tray, show/hide + FS / prefs IPC                                                                                                              |

Management is in **Settings only** — Habitat has no companion admin page.

On host start: Habitat config wins; `~/.anima/companion/config.json` on the desktop is an **offline cache**. Legacy local data is migrated once to Habitat (`companion.migrate.fromLocal` or HTTP upload). Multiple desktops share the same model/motion library via Habitat.

```text
Settings ──Habitat RPC/HTTP──► features/companion (Habitat)
Static   ◄──sync.pull────► Habitat          ──► local cache (VRM/VRMA)
Overlay ──remote_tools.attach──► Habitat    （bubble / play_slot 本地执行）
Tauri   ◄──IPC──────────► Settings         (show/hide, connection status)
Agent    ──Habitat RPC tool.call─► Overlay
```

The content pack lives in [`src/features/companion/`](../../src/features/companion/) (`ui/spa/` + `server/` + `shared/`). Habitat domain logic: [`src/features/companion/`](../../src/features/companion/).

|            | Chat / other product modules | Companion                                        |
| ---------- | ---------------------------- | ------------------------------------------------ |
| UI         | Browser / shell Web UI       | Native transparent companion window + settings   |
| Deployment | Bundled in shell             | Dynamic attach when Habitat token is configured  |
| Protocol   | Habitat RPC only (no attach) | Habitat RPC + `remote_tools.attach` in overlay   |
| Runtime    | —                            | Overlay-local tool runtime（browser-dev 同路径） |

## Features

- VRM avatar rendering (Three.js + `@pixiv/three-vrm`); VRM 1.0 and 0.x auto orientation correction
- **Motion slots**: five slots — `idle`, `rest`, `walk`, `climb`, `in_place`; each slot binds 0..n VRMA clips; play by id or random; empty slot = no animation
- **Speech bubble**: one-way text queue; user click advances; no auto-dismiss; pushed by Habitat Agent via companion `bubble` tool
- Transparent always-on-top **work-area fullscreen** overlay; **fullscreen WebGL canvas**; character placed by in-window screen coordinates (footprint 160×260 for standing scale / patrol margins); avatar/bubble clickable, empty area click-through
- **Local interaction**: drag moves the character screen position (not the OS window); click body to play random motion from `in_place` slot
- **Patrol** (Settings → Behavior tab): idle patrol, double-click patrol, corner pause, patrol speed, return-to-start on launch, etc.
- System tray: show/hide companion, **Settings…** (open settings window), quit
- Settings tabs: **General** / **Behavior** / **Models** / **Motion slots** / **Motion library**

## Agent tools (host registration)

| Tool        | Parameters                           | Description                            |
| ----------- | ------------------------------------ | -------------------------------------- |
| `bubble`    | `text: string`                       | Enqueue text in speech bubble          |
| `play_slot` | `slot: string`; `motion_id?: string` | Play motion slot; `motion_id` optional |

Periodic content (e.g. scheduled jokes) is configured on **anima service / scheduled tasks**; the Agent calls `bubble`. Companion has no built-in timer.

Settings → Companion client section shows **instance id** and **remote tools connected**（overlay 上报 / ShellApi；无 token 时跳过 attach）。

## Models and motions

The repo **does not bundle** `.vrm` / `.vrma` files. **Habitat** is the SSOT: `companion_profile` entity in PostgreSQL plus files on the Habitat host at `~/.anima/companion/models/` and `motions/`. Each desktop keeps a **local cache** synced on host start (`companion.sync.pull`).

### VRM models

Settings → **Models** tab: list, import, delete, rename, switch current model. Upload goes to Habitat (`POST /rpc/v1/companion/model/upload`); host downloads missing files for overlay rendering.

During development, files in `src/features/companion/public/models/` serve as fallback.

### VRMA library and slots

Settings → **Motion library** tab: import VRMA, FBX, or ZIP (FBX is converted on **Habitat**, not on desktop). **Motion slots** tab assigns motions per slot. Preview supports mouse drag to rotate view.

Unbound slots play no animation; patrol still moves the window; walk/climb VRMA play only when bound.

### FBX import

FBX→VRMA runs on the **Habitat host** (`anima service`). Desktop installers no longer bundle `fbx2vrma-converter` or FBX2glTF. On the Habitat machine run `just misc setup-fbx` if FBX conversion is needed.

## Development and run

### Browser /dev companion host

```bash
bun src/features/companion/dev.ts
```

Uses an in-process HTTP server; runtime events use localhost WebSocket (`/api/runtime/ws`).

### Desktop (Tauri Portal)

The Portal overlay WebView hosts companion UI and `remote_tools.attach` (no Node sidecar). Window / IPC / FS come from Tauri commands. See [`.agent/rules/tauri-shell.md`](../../.agent/rules/tauri-shell.md).

## Settings storage

Companion config has two storage layers:

| Layer                                | Content                                                                             | Access                                                |
| ------------------------------------ | ----------------------------------------------------------------------------------- | ----------------------------------------------------- |
| **Habitat PG** (`companion_profile`) | Behavior, models, motion library, slots                                             | Settings → Habitat → Companion via Habitat RPC / HTTP |
| **Local device**                     | Window visibility (`companion-shell` scope), Habitat RPC runtime status (read-only) | Settings → local → Companion                          |

Local `~/.anima/companion/config.json` is only a **habitat-sync cache**; the settings UI does not read/write it directly.

After Habitat profile changes, the local cache syncs via `companion.sync.pull`; the overlay refreshes through `emitConfigChanged`.

See also: [Habitat RPC](../ops/habitat-rpc.md), [architecture companion section](../product/architecture.md#desktop-companion-habitat-ssot).
