---
title: Desktop Companion
---

# 桌面伴侣（Companion）

> **Dynamic SAP 卫星**：单体桌面 GUI 应用，不经 `config.yaml` managed 托管。

桌面伴侣（看板娘 / 桌宠）是运行在用户桌面上的 SAP Type B 应用：Tauri 透明壳 + 内嵌 Bun sidecar，通过 SAP 与 Hub Agent 联动。

## 架构

```text
用户桌面（单体应用）
├── Tauri 壳 — 透明置顶窗口、点击穿透、托盘、窗口走位
├── WebView — VRM 角色、聊天气泡、输入框
└── Bun sidecar — runSapTransport、relay、tool.register
         ↕ SAP WS（可跨机）
    anima service Hub
```

与 Parlor / 结对编程的区别：

|             | Parlor / 结对编程            | Companion               |
| ----------- | ---------------------------- | ----------------------- |
| UI          | 浏览器 Web UI                | 原生透明 GUI            |
| 部署        | Managed（可与 service 同机） | Dynamic（用户自行启动） |
| 客户端与 UI | 可分离                       | **不可分离**            |

## 功能（首版）

- VRM 角色渲染（Three.js + `@pixiv/three-vrm`）
- 透明置顶窗口 + 角色区域可点、空白穿透
- 屏幕边缘随机游走
- Agent 气泡（流式）+ 桌宠内输入框
- `tool.register`：`pet_say`、`pet_emote`、`pet_move`
- 首条消息时 `session.create`（platform: `companion`）
- 设置页：Hub URL、VRM 模型导入与路径

## 模型

仓库**不捆绑** `.vrm` 文件。推荐流程：

1. 从 [VRoid Hub](https://hub.vroid.com/) 或 [VRoid Studio](https://vroid.com/en/studio) 获取允许使用的 `.vrm` 模型
2. 在桌宠**设置页**点击「导入模型」，选择本地文件
3. 模型保存到 `~/.anima/companion/models/`（可通过 `FREEANIMA_HOME` 覆盖数据根目录），并自动更新 `model_path`

也可在设置中手动填写模型路径（支持 `/models/...` 或外部 URL）。开发期仍可将文件放入 `satellites/companion/public/models/` 作为回退目录。

配置持久化在 `~/.anima/companion/config.json`；首次启动会从旧的 `satellites/companion/companion-config.json` 一次性迁移。

## 开发与运行

### 浏览器开发（无需 Tauri）

```bash
# 确保 anima service 已启动
bun satellites/companion/dev.ts
# 打开 http://127.0.0.1:4176
```

环境变量：

| 变量                    | 默认                    | 说明               |
| ----------------------- | ----------------------- | ------------------ |
| `FREEANIMA_URL`         | `http://127.0.0.1:2658` | Hub 地址（可跨机） |
| `SATELLITE_PORT`        | `4176`                  | sidecar HTTP 端口  |
| `SATELLITE_INSTANCE_ID` | 随机 UUID               | 实例 ID            |

### Tauri 桌面壳

```bash
cd satellites/companion
bun install
bun dev.ts                    # 浏览器开发

# 本地快速打包（默认 fast：不 minify、仅 exe、sidecar 未改则跳过）
bun run build:windows

# CI / 发版（minify + NSIS 安装包）
bun run build:windows:installer
```

| 模式             | 命令                              | 说明                                             |
| ---------------- | --------------------------------- | ------------------------------------------------ |
| **fast**（默认） | `bun run build:windows`           | 优先速度：前端不压缩、只出 exe、sidecar 增量跳过 |
| **release**      | `bun run build:windows:installer` | 前端 minify + NSIS 安装包（CI 用）               |

产物：

| 文件        | fast                                   | release                                        |
| ----------- | -------------------------------------- | ---------------------------------------------- |
| exe         | `shell/target/.../companion-shell.exe` | 同左                                           |
| NSIS 安装包 | —                                      | `shell/target/.../bundle/nsis/*_x64-setup.exe` |

Linux 交叉编译依赖：`rustup target add x86_64-pc-windows-gnu`、`mingw-w64`；**仅 release 模式**还需 `nsis`、`libayatana-appindicator3-dev`。

运行时配置写入 `~/.anima/companion/config.json`（`FREEANIMA_HOME` 可改根目录）；VRM 模型放 `~/.anima/companion/models/`。仓库内 `companion-config.example.json` 仅为字段示例。

本机 Tauri 开发：`bun run build:sidecar` → `cd shell/src-tauri && cargo tauri dev`

## SAP 工具

| 本地名      | 说明                             |
| ----------- | -------------------------------- |
| `pet_say`   | 显示对话气泡                     |
| `pet_emote` | 切换表情（joy/angry/sad/think…） |
| `pet_move`  | 移动窗口到屏幕坐标               |

## 相关文档

- SAP 卫星指南：[`satellite-guide.md`](../sap/satellite-guide.md)
- SAP 安全模型：[`security-model.md`](../sap/security-model.md)
