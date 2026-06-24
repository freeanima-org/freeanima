---
title: Frontend Exports
---

# 前端三档导出约定

可嵌入 desktop-shell / app-mobile 的前端内容包通过 **manifest / desktop / mobile** 三档导出注册。

## Manifest（必选）

路径：`./manifest` — 可 `JSON.stringify` 的元信息。

| 字段              | 说明                                    |
| ----------------- | --------------------------------------- |
| `appId`           | 应用标识                                |
| `displayName`     | 显示名称                                |
| `version`         | 版本（通常与 monorepo 根 package 同步） |
| `supportsDesktop` | 是否支持桌面嵌入                        |
| `supportsMobile`  | 是否支持移动嵌入                        |
| `connectionKind`  | 见下表                                  |
| `sap`             | 可选；SAP 卫星才有                      |

### connectionKind

| 值                 | 代表                          | 是否需要 sidecar                   |
| ------------------ | ----------------------------- | ---------------------------------- |
| `embedded-sidecar` | companion（VRM + 工具）       | **是**（同进程 embedded）          |
| `sap-direct`       | chat（renderer 直连 Hub SAP） | **否**（仅需持久化 `instance_id`） |
| `hub-rest`         | 卧室 Chamber（Hub REST）      | **否**                             |

实现 SSOT：[`packages/satellite-sdk/src/manifest.ts`](../../packages/satellite-sdk/src/manifest.ts)

## Desktop / Mobile（可选）

- `./desktop` — 桌面壳编译期 import 的 profile（窗口规格、启动方式）
- `./mobile` — 移动端 profile；不支持时 `embedMode: "unsupported"`

`embedMode: "bundled-spa"` — UI 打进客户端安装包，本地静态托管；Hub 仅提供 `/api` 与 `/sap/v1`。

## 当前前端包

| 包                               | appId       | connectionKind     | embedMode     |
| -------------------------------- | ----------- | ------------------ | ------------- |
| `@freeanima/satellite-companion` | `companion` | `embedded-sidecar` | sidecar       |
| `@freeanima/satellite-chat`      | `chat`      | `sap-direct`       | `bundled-spa` |
| `@freeanima/frontend-chamber`    | `chamber`   | `hub-rest`         | `bundled-spa` |

壳应用：[`satellites/desktop-shell/`](../../satellites/desktop-shell/) · [`satellites/app-mobile/`](../../satellites/app-mobile/)

## Chat：SAP 直连与 instance_id

桌面/移动 chat 使用 [`createSapDirectClient`](../../packages/sap-contract/src/direct-client.ts) 直连 Hub `/sap/v1`。

`instance_id` 持久化：

- Electron 壳：preload 提供 `createFileInstanceStore("chat")` → `~/.anima/satellites/chat/instance.json`
- Capacitor：Preferences

## Chamber：Hub REST + bundled WebUI

卧室 UI 由 [`platform/connectors/webui/`](../../platform/connectors/webui/) 构建，经 [`frontends/chamber/build.ts`](../../frontends/chamber/build.ts) 打进 desktop / mobile。

REST 基址：bundled 页通过 `window.satelliteShell.hubUrl` 访问 Hub **`/api/*`**（非 `/webui` 下）。Hub 对 localhost / Capacitor origin 启用 CORS。

本地 WebUI 开发：`bun run dev:webui`（Hub 须已运行）。
