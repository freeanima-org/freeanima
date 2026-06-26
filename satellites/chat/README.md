# Chat satellite

聊天室 UI 内容包，由 **shell-ui** 组合进 desktop / mobile / web 壳层；运行时通过 **`createSapDirectClient`** 直连 Hub SAP（`/sap/v1`）。

## 导出

见 [`docs/sap/frontend-exports.md`](../../docs/sap/frontend-exports.md)：`./manifest` / `./desktop` / `./mobile`。

## 本地开发

Chat 无独立 dev/build 管线，与 Admin、Task 等同走统一 web 壳层：

```bash
anima service start --foreground   # 或已有 Hub
bun run dev:web                    # → http://127.0.0.1:4173/chat
```

Chat 使用 **singleton** 固定 `instance_id`（`def`，见 `@freeanima/sap-contract` 的 `CHAT_INSTANCE_ID`），无需 per-device 持久化。
