# 离线平台（Tier 2）

FreeAnima 卫星壳离线能力分三层：

| 层级          | 能力                      | 模块                                   |
| ------------- | ------------------------- | -------------------------------------- |
| Tier 1        | IndexedDB 只读快照        | Email、Notification、Console、Dream 等 |
| Tier 2-CRUD   | outbox + 乐观 KV          | Diary、Task                            |
| Tier 2-Hybrid | outbox + localStorage LWW | Pomodoro（active 计时）                |
| Tier 2-Stream | SAP 流式 flush            | Chat send                              |

## 平台原语（shell-sdk）

- `offline-cache` — Tier 1 KV 快照
- `offline-outbox` — 跨模块写队列
- `offline-id-map` / `offline-temp-id` — 本地负 id → server id
- `offline-module-registry` — Rpc / Stream 双适配器注册
- `offline-sync` — 重连/可见时 orchestrator flush + refreshAll
- `offline-cache-first` — `withOfflineCache()` 统一读路径
- `hub-fetch-gate` — `isHubFetchAvailable()`：断网 **或** Hub 非 `connected` 时不发起 Hub RPC 读/flush，只读 IndexedDB 快照

## 读路径 gate

`isHubFetchAvailable()` = `navigator.onLine !== false` **且** `getHubRpcConnectionState() === "connected"`。

- Tier 1：`withOfflineCache()` 内置 gate
- Tier 2 模块：`api.ts` / store 在拉列表前先读本地缓存，gate 为 false 时直接返回、不等待 RPC 超时
- `flushOfflineModule` / `flushAllOfflineModules`：gate 为 false 时 no-op，重连后由 `OfflineSyncBootstrap` 触发 flush

写 RPC 可选 `client_op_id`；flush 重试使用同一 id；create 响应含完整 `item` 供 id-map 写入。

## 接入清单

1. Hub 写 RPC 支持 `client_op_id`（若尚未有）
2. 实现 `features/<slug>/ui/spa/lib/offline-store.ts`（或 stream adapter）
3. `registerOfflineModule(adapter)` + `registerOfflineModuleCap({ offlineWritable: true })`
4. `api.ts` 写路径委托 offline-store
5. 更新 `docs/guide/remote-access.md`

冲突策略：单设备；flush 后 refreshAll，以 Hub 为准。
