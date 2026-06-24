---
title: Remote access
---

# Remote access（Tunnel + 应用 Token）

> 通过 **Cloudflare Tunnel** 将家里 PC 上的 Hub 暴露到公网时，由 Hub **`remote_auth`** Bearer Token 保护非本地连接。
> 安全上下文：[`security.md`](security.md) · 安装：[`install.md`](install.md)

## 概览

| 层                    | 作用                                                                                  |
| --------------------- | ------------------------------------------------------------------------------------- |
| **Hub `remote_auth`** | `config.yaml` 明文 token；REST `Authorization: Bearer`；SAP `connect` 帧 `auth_token` |
| **cloudflared**       | 出站隧道，把公网 HTTPS/WSS 转到 `127.0.0.1:2658`                                      |
| **客户端设置**        | app/desktop / app/mobile 在 **Hub 设置页**填写同一 Hub 地址与 token                   |

仅当 **Host 为 loopback**（`127.0.0.1` / `localhost` / `::1`）**且 TCP 对端也为 loopback** 时 **不验 token**（本地开发、CLI/systemd 探活）。公网域名（经 Tunnel）、局域网 IP 等访问时须带 token；与 `tunnel.enabled` 无关。

可选：仍可在 Cloudflare 配置 Access（浏览器 IdP 登录）；bundled 客户端走应用 Token，不依赖 Access。

## 1. Hub 配置

在 `~/.anima/config.yaml` 中设置（**仅本地使用可省略**；暴露到局域网或公网前必须配置）：

```yaml
remote_auth:
  token: "请替换为 openssl rand -base64 32 生成的随机串"
```

生成示例：

```bash
openssl rand -base64 32
```

`.gitignore` 已忽略 `config.yaml`；请勿提交到 git。Admin API 读配置时会对 `remote_auth.token` 脱敏显示。

## 2. Tunnel（可选）

```bash
anima tunnel setup   # 可跳过 Access API 步骤
anima service start
```

`tunnel.enabled: true` 时随服务启动 cloudflared。Ingress 指向本机 Hub 端口（默认 `2658`）。

若不使用 Tunnel，仅在局域网用 `http://<PC-IP>:2658` 亦可；客户端同样需在设置页填写 token。

### Cloudflare 凭证（pass）

| pass 路径                                | 用途                     |
| ---------------------------------------- | ------------------------ |
| `services/cloudflare/api-token`          | 创建 Tunnel / DNS        |
| `services/cloudflare/tunnel-credentials` | `cloudflared` 连接器凭证 |

详见向导 `anima tunnel setup`。

## 3. 客户端配置

**app/desktop** 与 **app/mobile** 均视为远端客户端，**不读取** Hub 的 `config.yaml`。

| 客户端      | 存储位置                     |
| ----------- | ---------------------------- |
| app/desktop | `~/.anima/shell-client.json` |
| app/mobile  | Capacitor Preferences        |

设置项（两端一致）：

1. **Hub 地址** — 如 `https://anima.example.com` 或 `http://192.168.1.10:2658`
2. **远程 Token** — 与 Hub `remote_auth.token` 相同

操作：打开 Hub 设置 → 填写 → **测试连接** → 保存。桌面端保存后需 **重启 app/desktop**。

## 4. 认证行为

```text
REST:  Authorization: Bearer <token>
SAP:   WebSocket /sap/v1 → connect 帧含 auth_token 字段
```

缺少或错误 token → HTTP `401` 或 SAP 连接关闭。

判定依据为请求 URL 的 **Host**（经 Tunnel 时为公网域名，如 `anima.example.com`）与 **TCP 对端地址**；Hub 不读取 `tunnel.enabled` 决定是否验 token。

## 运维命令

| 命令                          | 说明                      |
| ----------------------------- | ------------------------- |
| `anima tunnel status`         | Tunnel / cloudflared 状态 |
| `anima tunnel start` / `stop` | 侧车启停                  |
| `anima service status`        | Hub 是否运行              |

## 故障排查

| 现象                   | 检查                                                       |
| ---------------------- | ---------------------------------------------------------- |
| 公网 502               | Hub 是否运行？`anima service status`                       |
| 公网 1033              | `anima tunnel status` 中 `connected: no`                   |
| 401                    | 客户端 token 是否与 `remote_auth.token` 一致               |
| 本机开发正常、远程失败 | 远程请求是否带 Bearer / SAP auth_token；公网 Host 须 token |
| 改 token 后仍 401      | 更新 Hub config **并** 各客户端设置页                      |

## 相关文档

- 移动端：[`mobile-app.md`](../features/mobile-app.md)
- 桌面伴侣 Hub 来源：[`companion.md`](../features/companion.md)
