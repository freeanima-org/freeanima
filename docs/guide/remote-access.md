---
title: Remote access
---

# Remote access (Cloudflare Tunnel + Access)

> Expose Chamber WebUI to the public internet safely for **single-user** personal use.
> Prerequisites: domain on Cloudflare, Zero Trust team, Google (or other IdP) for Access login.
> Security context: [`security.md`](security.md) · install: [`install.md`](install.md)

## Overview

FreeAnima can publish `127.0.0.1:2658` via **Cloudflare Tunnel** (`cloudflared`) with **Cloudflare Access** authentication at the edge. Login happens on Cloudflare (e.g. Google), not in FreeAnima.

| Layer                    | Role                                                                    |
| ------------------------ | ----------------------------------------------------------------------- |
| Cloudflare Access        | User login, Allow policy (your email)                                   |
| cloudflared              | Outbound tunnel to local Hub                                            |
| FreeAnima JWT middleware | Validates `Cf-Access-Jwt-Assertion`; loopback direct access still works |

## Quick start

One command (interactive wizard includes cloudflared install):

```bash
anima tunnel setup
anima service start
```

Open `https://<your-hostname>/chamber/dashboard` from PC or mobile browser → sign in with Google (or configured IdP).

## Setup wizard

`anima tunnel setup` saves each answer to `~/.anima/config.yaml` as you go (`tunnel.enabled` stays `false` until success). Re-run the wizard to resume with saved values.

1. Public hostname (e.g. `anima.example.com`)
2. Zero Trust team name (e.g. `myteam` → `myteam.cloudflareaccess.com`)
3. Allowed email (single-user Allow policy)
4. Optional Cloudflare API Token — auto-creates Tunnel, DNS, and Access App
5. Session duration (default 7 days)

Secrets are stored in **pass**:

| pass 路径                                | 是什么                                                                | 谁提供                                             |
| ---------------------------------------- | --------------------------------------------------------------------- | -------------------------------------------------- |
| `services/cloudflare/api-token`          | **Cloudflare API Token** — 调用 Cloudflare API 创建 Tunnel/DNS/Access | 你在 Dashboard → 我的个人资料 → API 令牌 创建      |
| `services/cloudflare/tunnel-credentials` | **隧道连接器凭证** — `cloudflared` 连接 Cloudflare 用                 | setup 通过 API 自动生成，**不要**与 API Token 混淆 |

**不是** Zero Trust 控制台里「隧道 → 安装连接器」复制的那段令牌（那是旧版手动安装方式；本向导用 API Token 自动换取隧道凭证）。

Config is written to `~/.anima/config.yaml` under `tunnel:`.

Tunnel ingress targets the Hub at `127.0.0.1:<port>` where `<port>` comes from the running service (`server.status.json`) or defaults to `2658` — it is **not** a `tunnel:` config field. Use `anima service --port` for the Hub; `anima tunnel setup --port` only overrides during setup.

### Non-interactive

```bash
anima tunnel setup --non-interactive \
  --hostname anima.example.com \
  --team myteam \
  --email you@gmail.com \
  --access-api \
  --yes
```

Provide API Token via pass before running, or paste during interactive setup.

### Manual Access (no API Token)

If you skip the API Token, the wizard prints numbered Dashboard steps: create self-hosted Access App, Allow-by-email policy, copy **AUD** tag into `tunnel.access.audience`.

## Operations

| Command                | Description                                               |
| ---------------------- | --------------------------------------------------------- |
| `anima tunnel status`  | Tunnel / Access / cloudflared state                       |
| `anima tunnel start`   | Start cloudflared sidecar                                 |
| `anima tunnel stop`    | Stop sidecar                                              |
| `anima tunnel install` | Download cloudflared only (optional; setup includes this) |

When `tunnel.enabled: true`, `anima service start` also starts the tunnel sidecar (systemd user unit or foreground with `--foreground`).

## API Token permissions

创建 **API Token**（非隧道连接器令牌）时建议权限：

- Account — Cloudflare Tunnel: Edit
- Zone — DNS: Edit (auto CNAME)
- Account — Access: Apps and Policies: Edit (optional `--access-api`)

## Troubleshooting

| Symptom              | Check                                                            |
| -------------------- | ---------------------------------------------------------------- |
| Public URL 502       | Hub running? `anima service status`                              |
| Access login loop    | IdP enabled in Access App; email in Allow policy                 |
| 401 from Hub         | `tunnel.access.audience` matches Access App AUD                  |
| Local Chamber broken | Loopback bypass — use `http://127.0.0.1:2658` without CF headers |

## PC vs mobile

Each browser keeps its own Access session cookie. First visit on PC and phone each require one Google login; sessions renew per configured duration.
