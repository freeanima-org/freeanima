# Chat satellite

会客厅 UI 内容包。desktop-shell / app-mobile **bundled-spa** + **`createSapDirectClient`** 直连 Hub SAP（`/sap/v1`）。

`server/` 与 `dev.ts` 仅用于**本地 UI 开发**，不由 `anima service` 托管。

## 导出

见 [`docs/sap/frontend-exports.md`](../../docs/sap/frontend-exports.md)：`./manifest` / `./desktop` / `./mobile`。

## 本地开发

```bash
bun satellites/chat/dev.ts
# → http://127.0.0.1:4174/
```

需 Hub 已运行（SAP `/sap/v1`）。

## URLs（dev server）

| Path                     | Role                   |
| ------------------------ | ---------------------- |
| `http://127.0.0.1:4174/` | Chat UI                |
| `GET /config.json`       | `hub_ws_url`, `app_id` |
| `GET /health`            | Liveness               |

`instance_id` 由客户端持久化：Electron 壳 → `~/.anima/satellites/chat/instance.json`；Capacitor → Preferences。
