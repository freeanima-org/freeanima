---
title: "栖息地 RPC"
---

# 栖息地 RPC

**栖息地 RPC** 是栖息地客户端与 Agent 运行时之间的**唯一业务通道**。TypeScript 常量为 `HABITAT_RPC_VERSION`。传输：

- **WebSocket** — 长连接 **`/rpc/v1`**（connect 握手 + 心跳；栖息地 RPC `req`/`res`/`evt` 信封）
- **HTTP REST** — 无状态 GET/POST **`/rpc/v1/{method/path}`**（纯 JSON body 或 query；`Authorization: Bearer`）

实现于 [`packages/shared/habitat-rpc/`](../../packages/shared/habitat-rpc/)（WS 信封 + HTTP REST 辅助）与 [`packages/habitat/platform/habitat/http-rest-router.ts`](../../packages/habitat/platform/habitat/http-rest-router.ts)（HTTP 适配器）。功能方法 schema 在 [`packages/shared/rpc-contract/`](../../packages/shared/rpc-contract/)。

二进制 HTTP 方法（如 `tts.synthesize`、伴侣资源、TLS PEM/QR）走栖息地 RPC REST，经注册表 `request` / `response` 编码。公开探针（`health.probe`、`tls.ca.*`）为栖息地 RPC 方法，`auth: optional`。

## 工具：MCP 优先，远程注册少见

| 情形                                     | 机制                                        |
| ---------------------------------------- | ------------------------------------------- |
| 对端可拨号（有稳定入站 MCP/HTTP 监听）   | **MCP** — 彼此暴露工具                      |
| 主壳产品 UI（聊天室、任务、设置…）       | 仅栖息地 RPC — **不**做远程工具 attach      |
| 不可达的本地应用（栖息地无法拨入的监听） | 应用**主动连接**并经栖息地 RPC 注册远程工具 |

树内前哨：桌面**伴侣**浮层与**编码**前哨窗（同一 Tauri 入口）。编码会话应默认用前哨 FS/终端工具，且**不得**静默回落到栖息地本地 `file_*`。见 [`coding.md`](../modules/coding.md)。

## 远程工具注册

栖息地 RPC `connect` 之后，不可达本地应用调用：

1. `remote_tools.attach` — 以 `app_id` + 可选 `instance_id` 注册（首次省略；栖息地分配；同机可多实例）
2. `tool.register` — 发布本地工具
3. 栖息地随后发送 `tool.call` 事件；应用以 `tool.result` / `tool.error` 回复

路由键是 **`instance_id`**（跟随连接中的应用，不跟随入口壳）。工具名形如 `remote_{app}_{instance}_{local}`（会话 `platform_info.platform` 为 flat `coding`/`companion`，与工具名前缀分离）。

**调用路由：** 在 `tool.register` 时，栖息地将每个工具 handler 绑定到该前哨连接（`instance_id`）。调用已注册工具时在该绑定通道发送 `tool.call` — 不做会话 `outpost_*` 检查，也不为路由再解析工具名。断开则注销 toolset。会话 `outpost_app_id` / `outpost_instance_id` 仍为可选元数据（如哪个前哨打开了聊天）。`workspace_root` 仍可仅从对话 meta 取入载荷。

服务端：[`packages/habitat/capabilities/outpost/`](../../packages/habitat/capabilities/outpost/)。  
客户端辅助：`@freeanima/shared/rpc-contract` 中的 `createRemoteToolsHabitatAttach`。

## 端点

```text
ws://{habitat_host}:{port}/rpc/v1
http://{habitat_host}:{port}/rpc/v1/task/list
```

辅助：`@freeanima/shared/habitat-rpc` 中的 `resolveHabitatRpcWsUrl`、`buildHabitatRestRequest`。

## 客户端请求超时

三档默认（method `meta.timeoutMs` 或 `call(..., { timeoutMs })` 可覆盖）：

| 档     | 常量                           | 默认用途                                                                       |
| ------ | ------------------------------ | ------------------------------------------------------------------------------ |
| 读 3s  | `HABITAT_RPC_READ_TIMEOUT_MS`  | `dualTransportMeta(true)` / list·get·search                                    |
| 写 10s | `HABITAT_RPC_WRITE_TIMEOUT_MS` | `dualTransportMeta(false)` / create·patch·delete；`message.send` 首包 ack      |
| 长 30s | `HABITAT_RPC_LONG_TIMEOUT_MS`  | `longOpMeta()`：导入、`fts.rebuild`、LLM 探活/列表模型、sleep pipeline、TTS 等 |

特殊通道单独更长：邮件 IMAP `HABITAT_RPC_EMAIL_IMAP_TIMEOUT_MS`、同步 `HABITAT_RPC_EMAIL_SYNC_TIMEOUT_MS`、大批量导入 `HABITAT_RPC_BULK_IMPORT_TIMEOUT_MS`（10min，如滴答 CSV）、二进制大文件 `HABITAT_RPC_BINARY_TRANSFER_TIMEOUT_MS`。

## 客户端配置

| Profile      | Attach                          | 典型消费者                                 |
| ------------ | ------------------------------- | ------------------------------------------ |
| 打包 SPA     | **否**                          | 聊天室、任务、通知、日记、邮件             |
| 远程工具宿主 | **是**（`remote_tools.attach`） | 伴侣浮层；**编码**前哨窗；未来独立本地应用 |

打包 SPA 每次页面加载共享**一条**栖息地 RPC WebSocket。产品模块传简单 `platform` 通道（如 `"chat"`），从不传远程工具 `instance_id`。

## 重连

用 `runHabitatRpcTransport` 做连接、心跳与指数退避。detach 或 socket 关闭时，栖息地注销该 `instance_id` 的工具。

另见：[`companion.md`](../modules/companion.md)、[`architecture.md`](../product/architecture.md)。
