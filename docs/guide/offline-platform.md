---
title: Offline Platform
---

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
- `offline-id-map` / `offline-temp-id` — 本地负 id → server id；`subscribeIdMappings` 供 UI remap
- `offline-module-registry` — Rpc / Stream 双适配器注册
- `offline-sync` — 重连/可见时 orchestrator flush + refreshAll；flush 锁尾触发；compact 后删除被吸收的 IDB op
- `offline-cache-first` — `withOfflineCache()` 统一读路径
- `hub-fetch-gate` — `isHubFetchAvailable()`：断网 **或** Hub 非 `connected` 时不发起 Hub RPC 读/flush，只读 IndexedDB 快照

## 读路径 gate

`isHubFetchAvailable()` = `navigator.onLine !== false` **且** `getHubRpcConnectionState() === "connected"`。

- Tier 1：`withOfflineCache()` 内置 gate
- Tier 2 模块：`api.ts` / store 在拉列表前先读本地缓存，gate 为 false 时直接返回、不等待 RPC 超时
- `flushOfflineModule` / `flushAllOfflineModules`：gate 为 false 时 no-op，重连后由 `OfflineSyncBootstrap` 触发 flush；flush 进行中的新请求会在本轮结束后再跑一轮（尾触发）
- 自动 flush 连续失败达到 5 次后停止重试；`OfflineSyncBootstrap` 展示失败/冲突原因，支持单条重试、丢弃与「重连并重试全部」
- chat 流式 flush 在离开聊天页时回退到 headless context，全局 bar 仍可 flush

写 RPC 可选 `client_op_id`；flush 重试使用同一 id；create 响应含完整 `item` 供 id-map 写入。

**在线也走 outbox**：Diary / Task 的写路径（含 create）始终先写本地 KV + outbox，再 `scheduleFlush`；并非「仅离线才排队」。

## Temp id 生命周期契约（Tier 2-CRUD）

create flush 成功后，本地世界里不得再以「裸 temp id」作为查找键：

1. **Lookup 前解析**：update / delete / append 若传入 temp id，先经 `getIdMapping` 解析再查本地列表
2. **Flush 后立刻 rewrite KV**：create 成功写 id-map 的同时，把本地列表中的 temp 行改成 server id（不要只靠 `refreshAll` 丢掉 temp）
3. **UI remap**：订阅 `subscribeIdMappings`，把选中态 / 列表中的 temp 换成 real
4. **Compact 持久化**：`compactOutbox` 吸收的原始 op 必须从 IDB 删除
5. **Allocator seed**：写前 `seedTempIdAllocatorFromIdMap`，避免刷新后复用仍映射中的负 id

Pomodoro（Hybrid）不使用 temp entity id，不受本契约约束；session 用 `client_op_id` 幂等。

## 接入清单

1. Hub 写 RPC 支持 `client_op_id`（若尚未有）
2. 实现 `features/<slug>/ui/spa/lib/offline-store.ts`（或 stream adapter）
3. `registerOfflineModule(adapter)` + `registerOfflineModuleCap({ offlineWritable: true })`
4. `api.ts` 写路径委托 offline-store；CRUD create 须遵守上方 temp id 契约
5. 更新 `docs/guide/remote-access.md`

冲突策略：单设备；flush 后 refreshAll，以 Hub 为准。
