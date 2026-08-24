---
title: 跨实例联邦
---

# 跨实例联邦

星型拓扑：一个 **Hub**（公网入口 + Room 主序）+ 若干 **Satellite**（仅出站连接）。1 Hub = 1 联邦；实例不可同时担任 Hub 并加入他联邦。

## 角色

| 角色          | 公网                                    | 配置                                                                            |
| ------------- | --------------------------------------- | ------------------------------------------------------------------------------- |
| **Hub**       | 需要 `public.origin`（设置 → 公网访问） | `federation.enabled` + `role: hub`                                              |
| **Satellite** | 不需要                                  | `role: satellite` + `federation.hub`（人工填写 Hub origin / `fa_inst_` / 公钥） |
| **disabled**  | —                                       | 默认                                                                            |

Hub 联邦入站 WebSocket：`{public.origin 换 wss}/rpc/v1/federation/connect`

## 授信（仅人类操作，单向）

1. **Hub**：设置 → 跨实例联邦 → 角色 **Hub**，配置公网 `public.origin`。
2. **Satellite**：填写 `federation.hub`（Hub origin / `fa_inst_` / 公钥）并保存；进程**主动出站**连接。
3. **Hub 待授信列表**：未知 Satellite 握手成功后写入 `pending`；用户在 UI **批准**或**拒绝**（RPC `federation.satellite.approve|reject`，仅 user + full token）。
4. 批准后 Hub 推送 `federation.trust.granted`，Satellite 无需重连即可使用联邦 Room。
5. **禁止** Agent / ToolSet、MCP 自动批准；可选手动 `federation.satellite.create` 预授信（非主路径）。

## 安全

- 传输：TLS（与栖息地 HTTPS 共用）
- 应用：Ed25519 双向握手（Satellite hello → Hub 查表 → Hub ack）
- Satellite 校验 Hub 身份与 UI 配置的 `federation.hub` 一致

## Room（#18918）

- 联邦 Room 的 `seq` **仅在 Hub** 写入；Satellite 为只读副本 + 本地 Conversation 衍生。
- 全局 ID：`room-{hub_fa_inst_}-{nanoid}`
- 创建：Hub / Satellite UI 均可勾选「联邦群聊」；最终由 Hub 分配 ID 并广播 `room.federation.created`
- 同步：`room.federation.append` / `broadcast` / `catch_up`；UI 经 `room.syncStatus` 显示已同步 / 落后 N / Hub 不可用
- Hub 不可用时联邦 Room **全网只读**

## 与通讯录

- Hub 授信表是安全 SSOT；Contact 可选关联（`linked_contact_id`）
- 录入时可勾选「同时添加到通讯录」→ `create_contact`，写入 Commons 一条 `animas[].kind=external`
- 有 Contact ≠ 授信；有授信 ≠ 自动建 Contact

## 相关

- 身份：[`habitat-identity.md`](habitat-identity.md)
- 公网：`docs/ops/remote-access.md`（`public.origin`）
- 对话拓扑：[`conversation-topology.md`](conversation-topology.md)
- 通讯录：[`../modules/contact.md`](../modules/contact.md)
