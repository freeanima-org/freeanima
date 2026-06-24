---
title: Mobile app (Android)
---

# 移动端 APP（Android）

> Capacitor 壳 + 统一 shell-ui SPA（聊天室 / 管理台 / 设置）。  
> 实现包：[`app/mobile/`](../../app/mobile/)

## 范围

| 项       | 说明                                                        |
| -------- | ----------------------------------------------------------- |
| 平台     | **仅 Android** sideload（APK）；iOS 后续                    |
| 模块     | 聊天室 chat（`sap-direct`）+ 管理台 admin（`hub-rest`）     |
| Hub 配置 | APP **Hub 设置**：地址 + `remote_auth.token`（Preferences） |
| Hub 职责 | `/api` REST + `/sap/v1` WebSocket                           |

## 拓扑

```mermaid
flowchart LR
  Phone[Android WebView]
  Shell[shell-ui SPA]
  Chat["/chat"]
  Admin["/admin"]
  Settings["/settings"]
  Hub[Anima Service]

  Phone --> Shell
  Shell --> Chat
  Shell --> Admin
  Shell --> Settings
  Chat -->|SAP auth_token| Hub
  Admin -->|REST Bearer| Hub
```

移动端 REST **直连** Hub（无桌面 Electron 的 `/api` 本地代理）；须配置 `remote_auth.token` 且 Hub 允许 Capacitor Origin（`http://localhost`）。

## Hub 设置

1. 家里 PC：`anima service start --host 0.0.0.0`，并在 `~/.anima/config.yaml` 配置 `remote_auth.token`（见 [`remote-access.md`](../guide/remote-access.md)）。
2. （可选）`anima tunnel setup`，手机使用 `https://<your-hostname>`。
3. APP → **Hub 设置**（`/settings`）：
   - Hub 地址（Tunnel 域名或 `http://<PC-IP>:2658`；勿用 `127.0.0.1`）
   - 远程 Token（与 Hub `config.yaml` 中 `remote_auth.token` 相同，≥16 字符）
4. **测试连接** → **保存并进入** → 顶栏切换 **聊天室** / **管理台**。

非 loopback Hub 地址必须填写 token；REST 使用 `Authorization: Bearer`，SAP 在 `connect` 帧携带 `auth_token`。

## 排障

| 现象                                 | 常见原因                                                                                 |
| ------------------------------------ | ---------------------------------------------------------------------------------------- |
| 聊天输入无反应                       | 无选中会话（首装应自动建会话）；或 SAP 未连接                                            |
| 管理台 load failed / Failed to fetch | Hub 未 `--host 0.0.0.0`、Token 错误、防火墙；Chrome Remote Debugging 看请求是否带 Bearer |
| Not Found                            | 勿访问旧路径如 `/admin/dashboard/index.html`；应走 SPA `/admin/dashboard`                |

## 构建与 sideload

```bash
bun run app/mobile:build
cd app/mobile && bun run sync
cd android && ./gradlew assembleDebug
```

包内 README：[`app/mobile/README.md`](../../app/mobile/README.md)

## 与桌面壳对比

|             | Electron `app/desktop`                  | Capacitor `app/mobile`               |
| ----------- | --------------------------------------- | ------------------------------------ |
| 注入        | preload → `window.satelliteShell`       | `shell-bridge.js` → 同形 API         |
| Hub 配置    | Hub 设置 → `~/.anima/shell-client.json` | Hub 设置 → Preferences               |
| REST        | 本地静态服代理 `/api`（同源）           | 直连 `hubUrl/api/*`（CORS + Bearer） |
| instance_id | 文件 `~/.anima/satellites/chat/`        | Preferences                          |
| 内容        | chat + admin + companion                | chat + admin                         |
