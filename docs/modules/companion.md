---
title: Desktop Companion
---

# Desktop Companion

> **桌面伴侣** / **Companion**：产品功能。**伴侣浮层**（companion overlay）：Portal 透明 VRM 窗（`embedded-overlay`）。**Outpost**（前哨）：overlay 内 `remote_tools.attach` 角色。Target shell: **Tauri**（见 [`.agent/rules/tauri-shell.md`](../../.agent/rules/tauri-shell.md)）。Not managed via `config.yaml`；**禁止**再打独立 Node sidecar。

The content pack (React + VRM) is embedded by the **desktop Tauri shell** (`src/portal/app/tauri`). Packaged overlay loads from `frontendDist` `ui/companion/` via `WebviewUrl::App` (same custom protocol as the main window — **not** `file://` resources). The overlay connects with Habitat RPC, calls `remote_tools.attach`, and exposes local tools (`bubble`, `play_slot`) to the Agent. Product modules such as Chat use Habitat RPC only (no attach).

## Architecture

```text
FreeAnima Portal (src/portal/app/tauri)
├── Tauri (Rust) — tray / multi-window + prefs / IPC
│   ├── companion overlay — work-area fullscreen transparent; VRM stage + remote_tools.attach
│   ├── companion settings — settings in main window (Habitat RPC + object_storage.file.get)
│   ├── chat — Chat SPA (Habitat RPC, no remote_tools.attach)
│   └── habitat — Habitat WebView (Habitat RPC REST)
└── Renderer — portalShell; overlay owns attach + tool runtime
         ↕ Habitat RPC (+ remote_tools.attach in overlay only)
    anima service Habitat (runtime companion + object storage + FBX→VRMA)
```

### Habitat vs local boundary

| Layer              | Location                     | Responsibility                                                                                                                      |
| ------------------ | ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| **Habitat SSOT**   | `src/features/companion/`    | runtime 段 `companion`（behavior / slots / 模型与动作注册表 + `object_file_id`）；字节在对象存储；FBX→VRMA；Settings 经 Habitat RPC |
| **Settings UI**    | Desktop Settings → Companion | Habitat RPC（`companion.config.*`、model/motion CRUD）；二进制经 `object_storage.file.get`                                          |
| **Companion host** | overlay SPA (`spa/`)         | `remote_tools.attach`、本地 runtime；桌面经 `companion.sync.pull` 把缺文件落到本机缓存                                              |
| **Tauri host**     | `src/portal/app/tauri/`      | Transparent window, click-through, tray, show/hide + FS / prefs IPC                                                                 |

Management is in **Settings only** — Habitat has no companion admin page.

On host start: Habitat runtime `companion` wins; `~/.anima/companion/config.json` on the desktop is an **offline cache**. Legacy local data is migrated once to Habitat (`companion.migrate.fromLocal` or HTTP upload). Multiple desktops share the same model/motion library via Habitat.

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

The repo **does not bundle** `.vrm` / `.vrma` files. **Habitat** is the SSOT: runtime 段 `companion`（`models` / `motion_library` 仅 `{ name, object_file_id, sort }`；槽位与当前模型均引用 `object_file_id`）+ 对象存储字节。旧条目不迁移，须在 Settings **重新上传**。桌面本机缓存文件名由 `object_file_id` 推导（`{id}.vrm` / `{id}.vrma`）。

### VRM models

Settings → **Models** tab: list, import, delete, rename, **reorder** (上移/下移 → `companion.model.reorder`), switch current model. Upload goes to Habitat（`companion.model.upload` → `createObjectFile`）；加载走 `object_storage.file.get`。

During development, files in `src/features/companion/public/models/` serve as fallback.

### VRMA library and slots

Settings → **Motion library** tab: import VRMA, FBX, or ZIP (FBX is converted on **Habitat**, not on desktop); **reorder** via `companion.motion.reorder`. **Motion slots** tab assigns motions per slot. Preview supports mouse drag to rotate view.

Unbound slots play no animation; patrol still moves the window; walk/climb VRMA play only when bound.

### FBX import

FBX→VRMA runs on the **Habitat host** (`anima service`). Desktop installers no longer bundle `fbx2vrma-converter` or FBX2glTF. On the Habitat machine run `just misc setup-fbx` if FBX conversion is needed.

## Development and run

### Browser /dev companion host

```bash
bun src/features/companion/dev.ts
```

Uses an in-process HTTP server for static/HMR + localhost WebSocket (`/api/runtime/ws`). **Config always comes from Habitat RPC** (`companion.config.get`) — there is no local `GET /api/config`.

### Desktop (Tauri Portal)

The Portal companion overlay WebView hosts companion UI and `remote_tools.attach`（`embedMode: embedded-overlay`；禁止 Node sidecar）。Window / IPC / FS come from Tauri commands. See [`.agent/rules/tauri-shell.md`](../../.agent/rules/tauri-shell.md).

## Settings storage

Companion config has two storage layers:

| Layer                                               | Content                                                                             | Access                               |
| --------------------------------------------------- | ----------------------------------------------------------------------------------- | ------------------------------------ |
| **Habitat PG** (`habitat_runtime_config.companion`) | Behavior, models, motion library, slots（模块配置）                                 | Settings → Companion via Habitat RPC |
| **Local device**                                    | Window visibility (`companion-shell` scope), Habitat RPC runtime status (read-only) | Settings → local → Companion         |

Local `~/.anima/companion/config.json` is only a **habitat-sync cache**; the settings UI does not read/write it directly.

After Habitat companion config changes, the local cache syncs via `companion.sync.pull`; the overlay refreshes through `emitConfigChanged`.

See also: [Habitat RPC](../ops/habitat-rpc.md), [architecture companion section](../product/architecture.md#desktop-companion-habitat-ssot).
