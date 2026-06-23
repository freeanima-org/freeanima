# Chat satellite

Managed satellite for the chat UI. Browser connects **directly** to Hub SAP WebSocket (`/sap/v1`); the dev server only serves static assets and `/config.json`.

## Config

Add to `~/.anima/config.yaml`:

```yaml
satellites:
  chat:
    enabled: true
    command: bun
    args: ["satellites/chat/dev.ts"]
    env:
      SATELLITE_PORT: "4174"
```

Then `anima service restart` (or `anima service start --foreground`).

## URLs

| Path                     | Role                                                          |
| ------------------------ | ------------------------------------------------------------- |
| `http://127.0.0.1:4174/` | Chat UI                                                       |
| `GET /config.json`       | `hub_ws_url`, `instance_id`, `app_id` for browser SAP connect |
| `GET /health`            | Liveness                                                      |

Chamber → Satellites lists `app_id=chat` with `http_url` from browser SAP `connect` (`window.location.origin`).

## Development

```bash
bun satellites/chat/dev.ts
# or from this directory:
bun run dev
```

Requires Hub at `FREEANIMA_URL` (default `http://127.0.0.1:2658`).

## Architecture

Unlike pair-programming, chat has **no** server-side SAP client, hub-api, or local SSE. All session/stream traffic uses `createSapBrowserClient` from `@freeanima/sap-contract`.
