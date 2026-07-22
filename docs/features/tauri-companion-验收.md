---
title: Tauri Companion 验收
---

# Tauri Companion 验收清单（Phase 3）

人工验收（Agent 无法替代）：

| 平台               | VRM 渲染 | 透明窗 | 局部 click-through | 巡逻/拖拽 | remote_tools bubble |
| ------------------ | -------- | ------ | ------------------ | --------- | ------------------- |
| Windows (WebView2) |          |        |                    |           |                     |
| macOS (WKWebView)  |          |        |                    |           |                     |
| Linux (WebKitGTK)  |          |        |                    |           |                     |

开发：`just web`（另终端）+ `just tauri`；overlay 默认 `http://127.0.0.1:4176/?view=overlay`。

打包资源：`scripts/prepare-tauri-desktop-ui.ts` → `src-tauri/companion-dist/`。
