# Chat satellite

会客厅 UI 内容包。浏览器 / desktop-shell 使用 **`createSapDirectClient`** 直连 Hub SAP（`/sap/v1`）；dev server 仅静态托管 UI 与 `/config.json`（提供 `hub_ws_url`）。

## 导出

见 [`docs/sap/frontend-exports.md`](../../docs/sap/frontend-exports.md)：`./manifest` / `./desktop` / `./mobile`。

## Config（managed 静态托管）

```yaml
satellites:
  chat:
    enabled: true
    command: bun
    args: ["satellites/chat/dev.ts"]
    env:
      SATELLITE_PORT: "4174"
```

## URLs

| Path                     | Role                                    |
| ------------------------ | --------------------------------------- |
| `http://127.0.0.1:4174/` | Chat UI                                 |
| `GET /config.json`       | `hub_ws_url`, `app_id`（浏览器 dev 用） |
| `GET /health`            | Liveness                                |

`instance_id` 由客户端持久化：Electron 壳 → `~/.anima/satellites/chat/instance.json`；浏览器 dev → localStorage。

## Development

```bash
bun satellites/chat/dev.ts
```

Requires Hub at `FREEANIMA_URL` (default `http://127.0.0.1:2658`).

## Desktop shell

嵌入 [`satellites/desktop-shell/`](../desktop-shell/)：托盘 → **会客厅**；无 relay sidecar。
