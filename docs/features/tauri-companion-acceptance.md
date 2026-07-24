---
title: Tauri Companion Acceptance
---

# Tauri Companion 验收清单（Phase 3）

人工验收（Agent 无法替代）：

| 平台               | VRM 渲染 | 透明窗 | 局部 click-through | 巡逻/拖拽 | remote_tools bubble |
| ------------------ | -------- | ------ | ------------------ | --------- | ------------------- |
| Windows (WebView2) |          |        |                    |           |                     |
| macOS (WKWebView)  |          |        |                    |           |                     |
| Linux (WebKitGTK)  |          |        |                    |           |                     |

开发：`just dev web`（另终端）+ `just dev tauri`；overlay 为工作区全屏透明窗（角色舞台 160×260）。

打包资源：`scripts/prepare-tauri-ui.ts` → `src-tauri/ui/companion/`（`frontendDist`，`WebviewUrl::App`；勿再用 `file://` resources）。
