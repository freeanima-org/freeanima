# Glossary

管线与工作流： [`.agent/rules/i18n.md`](../.agent/rules/i18n.md)（SSOT）；写 docs / 填 PO： [`.agent/rules/docs-i18n.md`](../.agent/rules/docs-i18n.md)。**无人工译者** — AI agent 维护 PO 时必读本表。

| English (canonical) | 中文           | Notes                                                                                                         |
| ------------------- | -------------- | ------------------------------------------------------------------------------------------------------------- |
| Free Anima          | 逸灵风         | Product / brand                                                                                               |
| digital human       | 数字人类       | Not “digital life” as a loose metaphor                                                                        |
| **Habitat**         | **栖息地**     | Long-running process + admin UI; connect vs open by verb                                                      |
| **Portal**          | **入口**       | Class: connectors into Habitat; four **forms** below                                                          |
| Portal form         | 入口形态       | How a Portal is realized: application / browser / mcp / cli                                                   |
| application Portal  | 应用形态入口   | Form id `application`；实现为 **Shell（壳）** — 整窗 SPA（桌面/移动/Web）                                     |
| browser Portal      | 浏览器形态入口 | Form id `browser`；浏览器扩展（MV3）；代码 `src/portal/extension`；≠ Web 壳                                   |
| MCP Portal          | MCP 形态入口   | Form id `mcp`；Habitat 对外 `/mcp`（`mcp-server`）；**mcp-client 出站 ≠ 入口**                                |
| CLI Portal          | CLI 形态入口   | Form id `cli`；`anima` CLI（service / token / 运维）；代码 `src/portal/cli`                                   |
| **Outpost**         | **前哨**       | Remote-tool registrant: unreachable local app that `remote_tools.attach`（Portal 内嵌或独立工具；≠ Portal）   |
| Desktop Companion   | 桌面伴侣       | Product feature（VRM 角色 + 设置）；代码 feature `companion`；**≠** 已消除的 Node sidecar                     |
| companion overlay   | 伴侣浮层       | Portal 透明 VRM 窗（`embedMode: embedded-overlay` / window `kind: overlay`）；设置在主窗，不叫「伴侣窗口」    |
| Shell               | 壳             | Application-form Portal（desktop / mobile / web）；**not** Habitat；**not** app frame；**not** browser Portal |
| app frame           | 应用布局       | SPA chrome：模块 Rail/底栏、设置页 tabs↔侧栏；代码在 `app-frame`（`AppFrame`）；跟视口，非 Shell              |
| design system (UI)  | 设计系统       | Portal UI norms under `docs/ui/`; implementation `@freeanima/ui-kit`                                          |
| primitive (UI)      | 基元           | shadcn/ui-kit control (`Button`, `Dialog`, …); see `docs/ui/components.md`                                    |
| structure (UI)      | 结构           | ui-kit form/layout shells                                                                                     |
| composite (UI)      | 复合           | Cross-feature interaction chassis in `ui-kit/composite`                                                       |
| domain UI           | 领域 UI        | Feature-local product UI under `features/*/ui`                                                                |
| UI dimensions       | UI 三维度      | Orthogonal shell / layout / interaction; `docs/ui/dimensions.md`                                              |
| Chat                | 聊天室         | Chat room UI                                                                                                  |
| Conversation        | 对话           | User-facing term; not “Session” in Habitat UI                                                                 |
| Dashboard           | 仪表盘         | Habitat UI page at `/habitat/dashboard` only                                                                  |
| —                   | —              | Admin UI under `/habitat/*`                                                                                   |
| Self layer          | 自我层         | Architecture layer                                                                                            |
| Memory layer        | 记忆层         | Architecture layer                                                                                            |
| Perception layer    | 感知层         | Architecture layer                                                                                            |
| Estate layer        | 资源层         | Architecture layer                                                                                            |
| Body (Estate)       | 躯体           | Cognitive “what I run on”; **not** the Habitat process name                                                   |
| light sleep         | 浅睡           | Memory pipeline stage                                                                                         |
| deep sleep          | 深睡           | Memory pipeline stage                                                                                         |
| semantic memory     | 语义记忆       | Keep English identifier in code                                                                               |
| Gateway             | Gateway        | Message bridges (Discord / WeChat); **not** Portal                                                            |
| Service             | —              | CLI / systemd (`anima service`) only; not the product name for Habitat                                        |
| MCP / ACP           | MCP / ACP      | Protocol names；default tool interop when peers are dialable                                                  |
| Habitat RPC         | 栖息地 RPC     | Product UI / session 协议路径 `/rpc/v1`；also remote tool registration for unreachable local apps             |
| RPC                 | RPC            | Alias of Habitat RPC；协议字面量 `HabitatRPC/1.0`                                                             |
| instance_id         | instance_id    | Habitat-assigned id for one Outpost instance（同机可多实例；不跟 Portal 壳走）                                |
| remote tools        | 远程工具       | Unreachable local app connects to Habitat and registers tools；Habitat reverse-calls via `tool.*`             |
| offline snapshot    | 只读快照       | Shell IndexedDB read-only cache（`withOfflineCache`）；not outbox                                             |
| offline outbox      | 离线写队列     | Pending write ops（`OfflineOutboxOp`）；modules with `offlineWritable`                                        |
| offline sync        | 离线同步       | Reconnect/visibility flush + module `refreshAll`（`OfflineSyncBootstrap`）                                    |
| Portal data plane   | Portal 数据面  | Cross-cutting Portal↔Habitat data consistency aspect（`docs/aspects/portal-data-plane.md`）；亦称数据流切面   |
| aspect（docs）      | 切面           | `docs/aspects/`：设计/功能横切面，≠ `docs/modules/` 具名产品能力                                              |
| flush               | flush          | Push outbox ops to Habitat；code identifier keep English                                                      |
| refresh（page）     | 刷新           | User-driven re-fetch of current view；≠ sync                                                                  |
| connectivity        | 连接状态       | Network / Habitat link UI（`ShellConnectivityBar`）；≠ outbox                                                 |
