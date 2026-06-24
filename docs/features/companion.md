---
title: Desktop Companion
---

# 桌面伴侣（Companion）

> **Dynamic SAP 卫星**：单体桌面 GUI 应用，不经 `config.yaml` managed 托管。

桌面伴侣是 SAP **Type B** 应用（embedded sidecar 持 Hub WebSocket、`relay: false`）：**内容包**（React + VRM + Node sidecar）由通用 **desktop-shell** 嵌入，通过 SAP 向 Hub 注册并向 Agent 暴露本地工具。

## 架构

```text
FreeAnima Desktop（satellites/desktop-shell）
├── Electron Main — 托盘/多窗 + 内嵌 companion sidecar
│   ├── companion overlay — 透明置顶，VRM / 气泡
│   ├── companion settings — 设置窗
│   ├── chat — 会客厅 SPA（SAP 直连，无 sidecar）
│   └── chamber — 卧室 WebView（Hub REST）
└── Renderer — preload satelliteShell；companion API 走 localhost sidecar
         ↕ SAP WS
    anima service Hub
```

内容包位于 [`satellites/companion/`](../../satellites/companion/)（`app/` + `server/` + `shared/`），导出约定见 [`frontend-exports.md`](../sap/frontend-exports.md)。

与 Chat / 结对编程的区别：

|             | Chat / 结对编程              | Companion                                    |
| ----------- | ---------------------------- | -------------------------------------------- |
| UI          | 浏览器 Web UI                | 原生透明伴侣窗 + 独立设置窗                  |
| 部署        | Managed（可与 service 同机） | Dynamic（用户自行启动）                      |
| SAP         | Type A 或 Type B + relay     | Type B + tools，无 relay                     |
| 客户端与 UI | 可分离                       | 伴侣渲染与设置窗分离，同属一个 Electron 应用 |

## 功能

- VRM 角色渲染（Three.js + `@pixiv/three-vrm`）；VRM 1.0 与 0.x 自动校正朝向
- **动作槽位（Motion Slot）**：`idle`、`rest`、`walk`、`climb`、`in_place` 五个槽位；每槽位可绑定 0..n 个 VRMA，播放时指定或随机；槽位为空则不播放动画
- **文字气泡**：单向文字队列；用户点击切换下一条，不自动消失；由 Hub Agent 通过 `companion.bubble` 工具推送
- 透明置顶 companion 窗（160×260）+ 角色区域可点、空白穿透
- **本地交互**：拖拽移动窗口；点击身体任意部位从 `in_place` 槽位随机播放动作
- **巡逻**（可在设置 → 行为 Tab 配置）：空闲自动巡逻、双击巡逻、角点停顿、巡逻速度、启动归位等
- 系统托盘：显示/隐藏伴侣、打开设置、退出
- 设置窗 Tab：**通用** / **行为** / **模型** / **动作槽位** / **动作库**

## Agent 工具（sidecar 注册）

| 工具        | 参数                                 | 说明                           |
| ----------- | ------------------------------------ | ------------------------------ |
| `bubble`    | `text: string`                       | 文字入气泡队列                 |
| `play_slot` | `slot: string`；`motion_id?: string` | 播放动作槽位；`motion_id` 可选 |

定时笑话等周期性内容在 **anima service / 定时任务** 侧配置，由 Agent 调用 `bubble` 推送；Companion 不内置定时器。

## 模型与动作

仓库**不捆绑** `.vrm` / `.vrma` 文件。配置持久化在 `~/.anima/companion/config.json`（含 `models`、`motion_library`、`motion_slots`、`behavior`）。

### VRM 模型

在设置 → **模型** Tab：列表、导入、删除、重命名、切换当前模型。文件保存到 `~/.anima/companion/models/`。

开发期可将文件放入 `satellites/companion/public/models/` 作为回退目录。

### VRMA 动作库与槽位

在设置 → **动作库** Tab 导入 VRMA 动作包 ZIP 或单个文件；在 **动作槽位** Tab 为各槽位勾选动作。

动作文件目录：`~/.anima/companion/motions/`。未绑定槽位时不播放对应动画；巡逻位移仍会平移窗口，仅在有 `walk` / `climb` VRMA 时播放移动动画。

## 开发与运行

### 浏览器开发（无需 Electron）

```bash
bun satellites/companion/dev.ts
# 伴侣：http://127.0.0.1:4176
# 设置：页面内「设置」按钮打开面板弹窗（非独立路由）
```

### Electron 桌面壳（含伴侣 + 会客厅 + 卧室）

```bash
cd satellites/desktop-shell
bun install
bun dev:electron
```

打包：

```bash
cd satellites/desktop-shell
bun run build:windows:installer   # Windows NSIS
```

环境变量：

| 变量                     | 默认                    | 说明                                     |
| ------------------------ | ----------------------- | ---------------------------------------- |
| `FREEANIMA_URL`          | `http://127.0.0.1:2658` | 无 `shell-client.json` 时的 Hub 回退地址 |
| `SATELLITE_PORT`         | `4176`                  | 本地 HTTP 端口                           |
| `COMPANION_VRMA_ZIP_URL` | （空）                  | 可选；直链 zip 镜像，启动时下载          |

Hub 地址与远程 Token 由桌面壳 **`~/.anima/shell-client.json`** 统一管理（托盘 → **Hub 设置…**）。伴侣设置 → 通用 Tab 只读展示 Hub 地址。

Hub 在首次 `connect` 时分配 **3 字符** `instance_id`，写入 `~/.anima/companion/instance.json`（非 `satellites/` 子目录）。

### 常见问题

| 现象             | 处理                                                                               |
| ---------------- | ---------------------------------------------------------------------------------- |
| 双击无窗口       | 看系统托盘；托盘 → **设置…** 导入 `.vrm`                                           |
| 点击无动作       | 设置 → **动作库** 导入 VRMA；**动作槽位** 绑定对应槽位                             |
| 无法连 Hub       | 确认 `anima service` 与 `remote_auth.token`；托盘 **Hub 设置** 中地址与 token 正确 |
| 动作导入后无变化 | 导入后会热重载；若仍无效，确认槽位已勾选对应动作                                   |
| 后台服务失败     | 查看 `~/.anima/desktop-shell/shell.log`；确认端口 4176–4185 可用                   |

## 相关文档

- SAP 卫星指南：[`satellite-guide.md`](../sap/satellite-guide.md)
- SAP 安全模型：[`security-model.md`](../sap/security-model.md)
