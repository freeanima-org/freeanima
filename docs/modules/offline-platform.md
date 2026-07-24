---
title: Offline Platform
---

# 离线平台

FreeAnima 卫星壳离线能力按**读/写能力**划分（勿再使用 Tier 编号）：

| 能力          | 叫法                     | 机制                      | 模块                                   |
| ------------- | ------------------------ | ------------------------- | -------------------------------------- |
| 只读本地副本  | **snapshot**（只读快照） | IndexedDB KV              | Email、Notification、Habitat、Dream 等 |
| 可写 + 写队列 | **CRUD outbox**          | outbox + 乐观 KV          | Diary、Task、Project                   |
| 可写 + 写队列 | **Hybrid outbox**        | outbox + localStorage LWW | Pomodoro（active 计时）                |
| 可写 + 写队列 | **Stream outbox**        | SAP 流式 flush            | Chat send                              |

可写模块统一用 `offlineWritable: true` 标记（outbox 模块）。

## 词表

| 概念         | 叫法                            | 代码                                                  | 含义                                        |
| ------------ | ------------------------------- | ----------------------------------------------------- | ------------------------------------------- |
| 只读本地副本 | snapshot                        | `offline-cache` / `withOfflineCache`                  | 栖息地不可用时只读；在线必打 Habitat 并回写 |
| 可写离线模块 | outbox 模块 / `offlineWritable` | `registerOfflineModuleCap({ offlineWritable: true })` | 离线可改，失败入队，重连 flush              |
| 写队列条目   | outbox                          | `offline-outbox` / `OfflineOutboxOp`                  | 待同步写操作                                |
| 写路径形状   | CRUD / Hybrid / Stream          | `kind: "rpc"`、Pomodoro LWW、`kind: "stream"`         | 如何本地写与如何 flush                      |
| 在线写优先   | `preferOnlineWrite`             | 同名                                                  | 在线直连 Habitat；仅传输失败回退 outbox     |
| 推队列       | flush                           | `flushOfflineModule` / `flushAllOfflineModules`       | 把 outbox 打到 Habitat                      |
| 重连编排     | sync                            | `offline-sync` / `OfflineSyncBootstrap`               | 重连/可见时 flush + 模块 `refreshAll`       |
| 用户拉视图   | refresh                         | 页头刷新 / pull-to-refresh                            | 与 sync 职责分离                            |
| 连接状态 UI  | connectivity                    | `connectivity-notice` / `ShellConnectivityBar`        | 断网 vs Habitat 未连；**不是** outbox       |

## 平台原语（portal-sdk）

- `offline-cache` — snapshot KV
- `offline-outbox` — 跨模块写队列
- `offline-id-map` / `offline-temp-id` — 本地负 id → server id；`subscribeIdMappings` 供 UI remap
- `offline-module-registry` — Rpc / Stream 双适配器注册
- `offline-sync` — 重连/可见时 orchestrator flush + refreshAll；flush 锁尾触发；compact 后删除被吸收的 IDB op
- `offline-cache-first` — `withOfflineCache()`：**在线栖息地优先** / 离线只读快照（可与 IDB 并行读作失败回退）
- `prefer-online-write` — `preferOnlineWrite()`：在线写优先 Habitat RPC；仅网络/传输失败回退 outbox；业务错误直接抛出
- `habitat-fetch-gate` — `isHabitatFetchAvailable()`：断网 **或** Habitat 非 `connected` 时不发起 Habitat RPC 读/flush，只读 IndexedDB 快照

## 在线栖息地优先 / 离线本地优先

`isHabitatFetchAvailable()` = `navigator.onLine !== false` **且** `getHabitatRpcConnectionState() === "connected"`。

### 读

- 栖息地可用：必打 Habitat（缓存命中不短路）；成功后异步写回本地 KV；fetch 失败回退快照
- 栖息地不可用：只读本地；无缓存则抛 offlineError
- snapshot / outbox 模块 list·get：优先 `withOfflineCache()`；手写路径须同语义

### 写（全体 outbox 模块：在线不入 outbox）

| 形状          | 模块                   | 在线                                                                                                                      | 离线 / 传输失败                                              |
| ------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| CRUD outbox   | Diary / Task / Project | `preferOnlineWrite` → 直连 Habitat RPC（带 `client_op_id`），响应回写本地 KV，**不入 outbox**；create 直接得到服务端正 id | 乐观 KV + outbox + `scheduleFlush`（含仍为未映射的 temp id） |
| Hybrid outbox | Pomodoro               | `preferOnlineWrite` → Habitat RPC（config / active / session），**不入 outbox**；本地 LWW 仍即时写                        | enqueue outbox，重连 flush                                   |
| Stream outbox | Chat                   | 栖息地可用：内存 `client_op_id` + 直发 message stream，**不入 outbox**                                                    | enqueue outbox；仅传输失败从在线直发回退入队                 |

- 业务校验 / 尾冲突等错误抛给 UI，不进「可自动重试」队列
- 模块接线：gate / 错误分流认 sdk（`preferOnlineWrite` / `isRetriableOfflineWriteError`）；不抽泛型 CRUD 框架

### Flush / 同步 UI

- `flushOfflineModule` / `flushAllOfflineModules`：gate 为 false 时 no-op，重连后由 `OfflineSyncBootstrap` 触发；flush 锁尾触发
- 自动 flush 连续失败达到 5 次后停止重试
- **Bootstrap toast**：展示 **failed / stale**（任意连接状态）；纯 **pending** 仅在 Habitat **未** `connected` 时展示。`connected` 下正常排队/在线直发不得弹「重新连接并全部重试」
- 失败/冲突 toast：单条 **重试** + **丢弃**；「重连并全部重试」仅用于未连接时的纯 pending toast
- chat 流式 flush 在离开聊天页时回退到 headless context，全局 bar 仍可 flush

写 RPC 可选 `client_op_id`；flush 重试使用同一 id；create 响应含完整 `item` 供 id-map 写入。

## Temp id 生命周期契约（CRUD outbox）

create flush 成功后，本地世界里不得再以「裸 temp id」作为查找键：

1. **Lookup 前解析**：update / delete / append 若传入 temp id，先经 `getIdMapping` 解析再查本地列表
2. **Flush 后立刻 rewrite KV**：create 成功写 id-map 的同时，把本地列表中的 temp 行改成 server id（不要只靠 `refreshAll` 丢掉 temp）
3. **UI remap**：订阅 `subscribeIdMappings`，把选中态 / 列表中的 temp 换成 real
4. **Compact 持久化**：`compactOutbox` 吸收的原始 op 必须从 IDB 删除
5. **Allocator seed**：写前 `seedTempIdAllocatorFromIdMap`，避免刷新后复用仍映射中的负 id

在线 write-through create 不产生 temp id，不受本契约约束。Pomodoro（Hybrid）不使用 temp entity id；session 用 `client_op_id` 幂等。

## 接入清单

1. Habitat 写 RPC 支持 `client_op_id`（若尚未有）
2. 实现 `features/<slug>/ui/spa/lib/offline-store.ts`（或 stream adapter）
3. `registerOfflineModule(adapter)` + `registerOfflineModuleCap({ offlineWritable: true })`
4. `api.ts`：读走 `withOfflineCache`（或同语义）；写委托 offline-store，入口包 `preferOnlineWrite`
5. 更新 `docs/ops/remote-access.md`（若边界变化）

冲突策略：单设备；flush 后 refreshAll，以 Habitat 为准。

## Sync vs page refresh

`offline-sync` / `OfflineSyncBootstrap` 负责 **sync**（重连与可见时 flush + 有 outbox 模块的 `refreshAll`）。用户点「刷新」或下拉刷新是 **refresh**（当前页重新拉取视图），二者职责分离。产品页矩阵与交互约定见 [`docs/modules/page-refresh.md`](page-refresh.md)。
