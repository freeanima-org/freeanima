# Glossary

管线与工作流： [`.agent/rules/i18n.md`](../.agent/rules/i18n.md)（SSOT）；写 docs / 填 PO： [`.agent/rules/docs-i18n.md`](../.agent/rules/docs-i18n.md)。**无人工译者** — AI agent 维护 PO 时必读本表。

| English (canonical) | 中文       | Notes                                                                                                   |
| ------------------- | ---------- | ------------------------------------------------------------------------------------------------------- |
| Free Anima          | 逸灵风     | Product / brand                                                                                         |
| digital human       | 数字人类   | Not “digital life” as a loose metaphor                                                                  |
| **Habitat**         | **栖息地** | Long-running process + admin UI; connect vs open by verb                                                |
| **Portal**          | **入口**   | Class name: Shell, MCP, and similar external connectors into Habitat                                    |
| Shell               | 壳         | A Portal (desktop / mobile / web); not the Habitat itself                                               |
| Chat                | 聊天室     | Chat room UI                                                                                            |
| Conversation        | 对话       | User-facing term; not “Session” in Habitat UI                                                           |
| Dashboard           | 仪表盘     | Habitat UI page at `/habitat/dashboard` only                                                            |
| —                   | —          | Legacy `/console/*` → `/habitat/*`; legacy `/hub/rpc/v1` → `/rpc/v1`（至 0.9.3，其后删除）              |
| Self layer          | 自我层     | Architecture layer                                                                                      |
| Memory layer        | 记忆层     | Architecture layer                                                                                      |
| Perception layer    | 感知层     | Architecture layer                                                                                      |
| Estate layer        | 资源层     | Architecture layer                                                                                      |
| Body (Estate)       | 躯体       | Cognitive “what I run on”; **not** the Habitat process name                                             |
| light sleep         | 浅睡       | Memory pipeline stage                                                                                   |
| deep sleep          | 深睡       | Memory pipeline stage                                                                                   |
| semantic memory     | 语义记忆   | Keep English identifier in code                                                                         |
| Gateway             | Gateway    | Message bridges (Discord / WeChat); **not** Portal                                                      |
| Service             | —          | CLI / systemd (`anima service`) only; not the product name for Habitat                                  |
| MCP / ACP           | MCP / ACP  | Protocol names                                                                                          |
| RPC                 | RPC        | Habitat HTTP/WS API at `/rpc/v1`；协议字面量 canonical `HabitatRPC/1.0`（legacy `HubRPC/1.0` 至 0.9.3） |
