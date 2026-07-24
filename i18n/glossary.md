# Glossary

管线与工作流： [`.agent/rules/i18n.md`](../.agent/rules/i18n.md)（SSOT）；写 docs / 填 PO： [`.agent/rules/docs-i18n.md`](../.agent/rules/docs-i18n.md)。**无人工译者** — AI agent 维护 PO 时必读本表。

| English (canonical) | 中文        | Notes                                                                                                       |
| ------------------- | ----------- | ----------------------------------------------------------------------------------------------------------- |
| Free Anima          | 逸灵风      | Product / brand                                                                                             |
| digital human       | 数字人类    | Not “digital life” as a loose metaphor                                                                      |
| **Habitat**         | **栖息地**  | Long-running process + admin UI; connect vs open by verb                                                    |
| **Portal**          | **入口**    | Class name: Shell, MCP, and similar external connectors into Habitat                                        |
| **Outpost**         | **前哨**    | Remote-tool registrant: unreachable local app that `remote_tools.attach`（Portal 内嵌或独立工具；≠ Portal） |
| Shell               | 壳          | A Portal (desktop / mobile / web); **not** Habitat; **not** app frame (侧栏/底栏/设置 chrome)               |
| app frame           | 应用布局    | SPA chrome：模块 Rail/底栏、设置页 tabs↔侧栏；代码在 `app-ui`（`AppFrame`）；跟视口，非 Shell               |
| Chat                | 聊天室      | Chat room UI                                                                                                |
| Conversation        | 对话        | User-facing term; not “Session” in Habitat UI                                                               |
| Dashboard           | 仪表盘      | Habitat UI page at `/habitat/dashboard` only                                                                |
| —                   | —           | Admin UI under `/habitat/*`                                                                                 |
| Self layer          | 自我层      | Architecture layer                                                                                          |
| Memory layer        | 记忆层      | Architecture layer                                                                                          |
| Perception layer    | 感知层      | Architecture layer                                                                                          |
| Estate layer        | 资源层      | Architecture layer                                                                                          |
| Body (Estate)       | 躯体        | Cognitive “what I run on”; **not** the Habitat process name                                                 |
| light sleep         | 浅睡        | Memory pipeline stage                                                                                       |
| deep sleep          | 深睡        | Memory pipeline stage                                                                                       |
| semantic memory     | 语义记忆    | Keep English identifier in code                                                                             |
| Gateway             | Gateway     | Message bridges (Discord / WeChat); **not** Portal                                                          |
| Service             | —           | CLI / systemd (`anima service`) only; not the product name for Habitat                                      |
| MCP / ACP           | MCP / ACP   | Protocol names；default tool interop when peers are dialable                                                |
| Habitat RPC         | 栖息地 RPC  | Product UI / session 协议路径 `/rpc/v1`；also remote tool registration for unreachable local apps           |
| RPC                 | RPC         | Alias of Habitat RPC；协议字面量 `HabitatRPC/1.0`                                                           |
| instance_id         | instance_id | Habitat-assigned id for one Outpost instance（同机可多实例；不跟 Portal 壳走）                              |
| remote tools        | 远程工具    | Unreachable local app connects to Habitat and registers tools；Habitat reverse-calls via `tool.*`           |
| offline snapshot    | 只读快照    | Shell IndexedDB read-only cache（`withOfflineCache`）；not outbox                                           |
| offline outbox      | 离线写队列  | Pending write ops（`OfflineOutboxOp`）；modules with `offlineWritable`                                      |
| offline sync        | 离线同步    | Reconnect/visibility flush + module `refreshAll`（`OfflineSyncBootstrap`）                                  |
| flush               | flush       | Push outbox ops to Habitat；code identifier keep English                                                    |
| refresh（page）     | 刷新        | User-driven re-fetch of current view；≠ sync                                                                |
| connectivity        | 连接状态    | Network / Habitat link UI（`ShellConnectivityBar`）；≠ outbox                                               |
