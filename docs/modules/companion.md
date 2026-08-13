---
title: 桌面伴侣
---

# 桌面伴侣

> **桌面伴侣** / **Companion**：产品功能。**伴侣浮层**（companion overlay）：入口透明 VRM 窗（`embedded-overlay`）。**前哨**（Outpost）：overlay 内 `remote_tools.attach` 角色。目标壳：**Tauri**（见 [`.cursor/rules/tauri-shell.mdc`](../../.cursor/rules/tauri-shell.mdc)）。不经 `config.yaml` 管理；**禁止**再打独立 Node sidecar。

内容包（React + VRM）由**桌面 Tauri 壳**（`src/portal/app/tauri`）嵌入。打包后的浮层从 `frontendDist` 的 `ui/companion/` 经 `WebviewUrl::App` 加载（与主窗同一自定义协议 —— **不是** `file://` 资源）。浮层用栖息地 RPC 连接，调用 `remote_tools.attach`，并向 Agent 暴露本机工具（`bubble`、`play_slot`）。聊天室等产品模块只用栖息地 RPC（不 attach）。

## 架构

```text
FreeAnima Portal (src/portal/app/tauri)
├── Tauri (Rust) — tray / multi-window + prefs / IPC
│   ├── companion overlay — work-area fullscreen transparent; VRM stage + remote_tools.attach
│   ├── companion settings — settings in main window (Habitat RPC + object_storage.file.get)
│   ├── chat — Chat SPA (Habitat RPC, no remote_tools.attach)
│   └── habitat — Habitat WebView (Habitat RPC REST)
└── Renderer — portalShell; overlay owns attach + tool runtime
         ↕ Habitat RPC (+ remote_tools.attach in overlay only)
    anima service Habitat (runtime companion + object storage)
```

### 栖息地 vs 本机边界

| 层              | 位置                      | 职责                                                                                                               |
| --------------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| **栖息地 SSOT** | `src/features/companion/` | runtime 段 `companion`（behavior / slots / 模型与动作注册表 + `object_file_id`）；字节在对象存储；设置经栖息地 RPC |
| **设置 UI**     | 桌面设置 → 伴侣           | 栖息地 RPC（`companion.config.*`、model/motion CRUD）；二进制经 `object_storage.file.get`                          |
| **伴侣宿主**    | overlay SPA（`spa/`）     | `remote_tools.attach`、本机 runtime；桌面经 `companion.sync.pull` 把缺文件落到本机缓存                             |
| **Tauri 宿主**  | `src/portal/app/tauri/`   | 透明窗、点击穿透、托盘、显隐 + FS / prefs IPC                                                                      |

管理**仅在设置**——栖息地没有伴侣管理页。

宿主启动时：栖息地 runtime `companion` 为准；桌面 `~/.anima/companion/config.json` 是**离线缓存**。遗留本机数据一次性迁入栖息地（`companion.migrate.fromLocal` 或 HTTP 上传）。多桌面经栖息地共享同一模型/动作库。

```text
Settings ──Habitat RPC/HTTP──► features/companion (Habitat)
Static   ◄──sync.pull────► Habitat          ──► local cache (VRM/VRMA)
Overlay ──remote_tools.attach──► Habitat    （bubble / play_slot 本地执行）
Tauri   ◄──IPC──────────► Settings         (show/hide, connection status)
Agent    ──Habitat RPC tool.call─► Overlay
```

内容包在 [`src/features/companion/`](../../src/features/companion/)（`ui/spa/` + `server/` + `shared/`）。栖息地域逻辑：[`src/features/companion/`](../../src/features/companion/)。

|         | 聊天室 / 其他产品模块     | 桌面伴侣                                       |
| ------- | ------------------------- | ---------------------------------------------- |
| UI      | 浏览器 / 壳 Web UI        | 原生透明伴侣窗 + 设置                          |
| 部署    | 打进壳内                  | 配置栖息地 token 后动态 attach                 |
| 协议    | 仅栖息地 RPC（不 attach） | 栖息地 RPC + overlay 内 `remote_tools.attach`  |
| Runtime | —                         | Overlay 本机工具 runtime（browser-dev 同路径） |

## 功能

- VRM 形象渲染（Three.js + `@pixiv/three-vrm`）；VRM 1.0 与 0.x 自动朝向校正
- **动作槽位**：五个槽位 — `idle`、`rest`、`walk`、`climb`、`in_place`；每槽绑定 0..n 个 VRMA 片段；按 id 或随机播放；空槽 = 无动画
- **语音气泡**：单向文本队列；用户点击前进；不自动消失；由栖息地 Agent 经伴侣 `bubble` 工具推送
- 透明置顶**工作区全屏**浮层；**全屏 WebGL canvas**；角色按窗内屏幕坐标放置（站立比例 / 巡逻边距脚印 160×260）；头像/气泡可点，空白处点击穿透
- **本机交互**：拖动移动角色屏幕位置（不是 OS 窗口）；点击身体从 `in_place` 槽随机播动作
- **巡逻**（设置 → 行为标签页）：空闲巡逻、双击巡逻、角落暂停、巡逻速度、启动时回到起点等
- 系统托盘：显示/隐藏伴侣、**设置…**（打开设置窗口）、退出
- 设置标签页：**常规** / **行为** / **模型** / **动作槽位** / **动作库**

## Agent 工具（宿主注册）

| 工具        | 参数                                 | 说明                           |
| ----------- | ------------------------------------ | ------------------------------ |
| `bubble`    | `text: string`                       | 在语音气泡中排队文本           |
| `play_slot` | `slot: string`；`motion_id?: string` | 播放动作槽位；`motion_id` 可选 |

周期性内容（如定时笑话）在 **anima service / 定时任务** 中配置；Agent 调用 `bubble`。伴侣无内置定时器。

设置 → 伴侣客户端区显示 **instance id** 与 **remote tools connected**（overlay 上报 / ShellApi；无 token 时跳过 attach）。

## 模型与动作

仓库**不捆绑** `.vrm` / `.vrma` 文件。**栖息地**是 SSOT：runtime 段 `companion`（`models` / `motion_library` 仅 `{ name, object_file_id, sort }`；槽位与当前模型均引用 `object_file_id`）+ 对象存储字节。新上传的 VRM/VRMA 落在 **Commons world**（`world_config.common`）；旧条目不迁移，须在设置中**重新上传**。桌面本机缓存文件名由 `object_file_id` 推导（`{id}.vrm` / `{id}.vrma`）。

### VRM 模型

设置 → **模型**标签页：列表、导入、删除、重命名、**排序**（上移/下移 → `companion.model.reorder`）、切换当前模型。上传到栖息地（`companion.model.upload` → `createObjectFile`）；加载走 `object_storage.file.get`。

开发时，`src/features/companion/public/models/` 中的文件作回退。

### VRMA 库与槽位

设置 → **动作库**标签页：导入单个 `.vrma` 文件（可多选；压缩包请先自行解压）；经 `companion.motion.reorder` **排序**。**动作槽位**标签页按槽分配动作。预览支持鼠标拖转视角。

未绑定槽不播动画；巡逻仍移动窗口；walk/climb VRMA 仅在绑定时播放。

## 开发与运行

### 浏览器 /dev 伴侣宿主

```bash
bun src/features/companion/dev.ts
```

使用进程内 HTTP 服务做静态/HMR + localhost WebSocket（`/api/runtime/ws`）。**配置始终来自栖息地 RPC**（`companion.config.get`）——没有本机 `GET /api/config`。

### 桌面（Tauri 入口）

入口伴侣浮层 WebView 承载伴侣 UI 与 `remote_tools.attach`（`embedMode: embedded-overlay`；禁止 Node sidecar）。窗口 / IPC / FS 来自 Tauri 命令。见 [`.cursor/rules/tauri-shell.mdc`](../../.cursor/rules/tauri-shell.mdc)。

## 设置存储

伴侣配置有两层存储：

| 层                                                  | 内容                                                                 | 访问                      |
| --------------------------------------------------- | -------------------------------------------------------------------- | ------------------------- |
| **栖息地 PG**（`habitat_runtime_config.companion`） | 行为、模型、动作库、槽位（模块配置）                                 | 设置 → 伴侣，经栖息地 RPC |
| **本机设备**                                        | 窗口可见性（`companion-shell` scope）、栖息地 RPC 运行时状态（只读） | 设置 → 本机 → 伴侣        |

本机 `~/.anima/companion/config.json` 只是 **habitat-sync 缓存**；设置 UI 不直接读写它。

栖息地伴侣配置变更后，本机缓存经 `companion.sync.pull` 同步。入口桌面上，设置调用 `emitConfigChanged` → Tauri 事件 `shell:config-changed`（跨 WebView）→ overlay `refreshConfig`。

**显示伴侣**：关 = **关闭** companion WebView（非 hide），SPA unmount 后 `remote_tools.attach` 拆除，伴侣离线；开 = `ensure_companion` 重建窗口并 attach。窗口关闭期间的配置变更在下次 show 的 `init` / `refreshConfig` 拉取。

**模型切换 / 导入**：导入即激活（`active_object_file_id`）。切换 `modelPath` 时 **立刻清场景并停巡逻**，下载完成前只显示 loading、不保留旧角色。加载失败时清场景并提示错误（不自动回退 active）；设置页经 `shell:companion-model-status` 显示桌面加载进度。非法 / 不完整 VRM 会映射为可读错误文案。桌面 overlay 为正交全屏相机，加载后关闭 MToon `screenCoordinates` 描边，避免黑剪影（设置预览仍用透视相机，不受影响）。

**二进制超时**：`object_storage.file.get` 与 `companion.model.upload` / `companion.motion.import` 客户端默认超时 10 分钟（`HABITAT_RPC_BINARY_TRANSFER_TIMEOUT_MS`）。

**Coding 前哨：** [编码工作台](./coding.md) 是同一 Tauri 入口内的兄弟前哨（`app_id: coding`）。与伴侣（隐藏显示会**关闭** WebView 并拆除 attach）不同，编码应**隐藏不关**，以便 Agent 工具调用保持活手。不要把 Coding 加进本功能包。

另见：[栖息地 RPC](../ops/habitat-rpc.md)、[架构伴侣节](../product/architecture.md#desktop-companion-habitat-ssot)、[coding.md](./coding.md)。
