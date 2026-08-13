# Glossary

管线与工作流：文案语言见 [`.cursor/rules/agent-bootstrap.mdc`](../.cursor/rules/agent-bootstrap.mdc)「文案语言」；术语以本表为准。**无人工译者** — AI agent 维护文案时必读本表。

| English (canonical)   | 中文             | Notes                                                                                                                                                       |
| --------------------- | ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Free Anima            | 逸灵风           | Product / brand                                                                                                                                             |
| digital human         | 数字人类         | Not “digital life” as a loose metaphor                                                                                                                      |
| **Habitat**           | **栖息地**       | Long-running process + admin UI; connect vs open by verb                                                                                                    |
| **Portal**            | **入口**         | Class: connectors into Habitat; four **forms** below                                                                                                        |
| Portal form           | 入口形态         | How a Portal is realized: application / browser / mcp / cli                                                                                                 |
| application Portal    | 应用形态入口     | Form id `application`；实现为 **Shell（壳）** — 整窗 SPA（桌面/移动/Web）                                                                                   |
| browser Portal        | 浏览器形态入口   | Form id `browser`；浏览器扩展（MV3）；代码 `src/portal/extension`；≠ Web 壳                                                                                 |
| MCP Portal            | MCP 形态入口     | Form id `mcp`；Habitat 对外 `/mcp`（`mcp-server`）；**mcp-client 出站 ≠ 入口**                                                                              |
| CLI Portal            | CLI 形态入口     | Form id `cli`；`anima` CLI（service / token / 运维）；代码 `src/portal/cli`                                                                                 |
| **Outpost**           | **前哨**         | Remote-tool registrant: unreachable local app that `remote_tools.attach`（Portal 内嵌或独立工具；≠ Portal）                                                 |
| Desktop Companion     | 桌面伴侣         | Product feature（VRM 角色 + 设置）；代码 feature `companion`；**≠** 已消除的 Node sidecar                                                                   |
| companion overlay     | 伴侣浮层         | Portal 透明 VRM 窗（`embedMode: embedded-overlay` / window `kind: overlay`）；设置在主窗，不叫「伴侣窗口」                                                  |
| Coding workbench      | 编码工作台       | Dev-machine Outpost window（explore / patch / terminal）；feature `coding`；同 Portal，≠ Companion，≠ PM `project`                                          |
| Coding outpost window | Coding 前哨窗    | Tauri 独立应用窗 + `remote_tools.attach`；关 UI 宜 hide 保 attach                                                                                           |
| stable_key            | stable_key       | World 跨机逻辑身份（`world_config.stable_key`）；前缀如 `git:` / `novel:` / `manual:`；**勿**称 `repo_key`                                                  |
| Project World         | 项目 World       | 一项目一（建议 public）World；编码笔记/任务边界；≠ PM 模块的 `project` 实体                                                                                 |
| workspace_root        | workspace_root   | 会话级本机 checkout 路径；Outpost FS/终端相对它执行                                                                                                         |
| Shell                 | 壳               | Application-form Portal（desktop / mobile / web）；**not** Habitat；**not** app frame；**not** browser Portal                                               |
| app frame             | 应用布局         | SPA chrome：模块 Rail/底栏、设置页 tabs↔侧栏；代码在 `app-frame`（`AppFrame`）；跟视口，非 Shell                                                            |
| design system (UI)    | 设计系统         | Portal UI norms under `docs/ui/`; implementation `@freeanima/ui-kit`                                                                                        |
| primitive (UI)        | 基元             | shadcn/ui-kit control (`Button`, `Dialog`, …); see `docs/ui/components.md`                                                                                  |
| structure (UI)        | 结构             | ui-kit form/layout shells                                                                                                                                   |
| composite (UI)        | 复合             | Cross-feature interaction chassis in `ui-kit/composite`                                                                                                     |
| domain UI             | 领域 UI          | Feature-local product UI under `features/*/ui`                                                                                                              |
| UI dimensions         | UI 三维度        | Orthogonal shell / layout / interaction; `docs/ui/dimensions.md`                                                                                            |
| Chat                  | 聊天室           | Chat room UI                                                                                                                                                |
| Conversation          | 对话             | User-facing term; not “Session” in Habitat UI                                                                                                               |
| Dashboard             | 仪表盘           | Habitat UI page at `/habitat/dashboard` only                                                                                                                |
| —                     | —                | Admin UI under `/habitat/*`                                                                                                                                 |
| Self layer            | 自我层           | Architecture layer                                                                                                                                          |
| Memory layer          | 记忆层           | Architecture layer                                                                                                                                          |
| Perception layer      | 感知层           | Architecture layer                                                                                                                                          |
| Estate layer          | 资源层           | Architecture layer                                                                                                                                          |
| Body (Estate)         | 躯体             | Cognitive “what I run on”; **not** the Habitat process name                                                                                                 |
| Capability Policy     | 能力策略         | Hard tools/data constraints; replaces Capability Mask / 能力面罩. Skills declare tool allow; callers declare deny. See `docs/modules/skills.md`             |
| Capability Mask       | （退役）能力面罩 | Historical name; do not use in new copy. Prefer Capability Policy / 能力策略                                                                                |
| Skill                 | 技能             | Procedural playbook entity (`primary_component=skill`); catalog in system prompt; body via `skill_load`                                                     |
| light sleep           | 浅睡             | Memory pipeline stage                                                                                                                                       |
| deep sleep            | 深睡             | Memory pipeline stage                                                                                                                                       |
| semantic memory       | 语义记忆         | Keep English identifier in code                                                                                                                             |
| Gateway               | Gateway          | Message bridges (Discord / WeChat); **not** Portal                                                                                                          |
| Service               | —                | CLI / systemd (`anima service`) only; not the product name for Habitat                                                                                      |
| MCP / ACP             | MCP / ACP        | Protocol names；default tool interop when peers are dialable                                                                                                |
| Habitat RPC           | 栖息地 RPC       | Product UI / session 协议路径 `/rpc/v1`；also remote tool registration for unreachable local apps                                                           |
| RPC                   | RPC              | Alias of Habitat RPC；协议字面量 `HabitatRPC/1.0`                                                                                                           |
| instance_id           | instance_id      | Habitat-assigned id for one Outpost instance（同机可多实例；不跟 Portal 壳走）                                                                              |
| remote tools          | 远程工具         | Unreachable local app connects to Habitat and registers tools；Habitat reverse-calls via `tool.*`                                                           |
| offline snapshot      | 只读快照         | Shell IndexedDB read-only cache（`withOfflineCache`）；not outbox                                                                                           |
| offline outbox        | 离线写队列       | Pending write ops（`OfflineOutboxOp`）；modules with `offlineWritable`                                                                                      |
| offline sync          | 离线同步         | Reconnect/visibility flush + module `refreshAll`（`OfflineSyncBootstrap`）                                                                                  |
| Portal data plane     | Portal 数据面    | Cross-cutting Portal↔Habitat data consistency aspect（`docs/aspects/portal-data-plane.md`）；亦称数据流切面                                                 |
| aspect（docs）        | 切面             | `docs/aspects/`：设计/功能横切面，≠ `docs/modules/` 具名产品能力                                                                                            |
| Notification          | 通知（收件箱）   | Inbox 行；可列表/标已读；落 PG。三分法见 `docs/aspects/notification-and-reminder.md`                                                                        |
| Reminder              | 提醒（意图）     | 「到点响」挂在实体上；**不是** Inbox 行                                                                                                                     |
| Alert                 | 本机打断         | 伴侣气泡或系统通知；只在本机；`deliverLocalReminder`                                                                                                        |
| flush                 | flush            | Push outbox ops to Habitat；code identifier keep English                                                                                                    |
| refresh（page）       | 刷新             | User-driven re-fetch of current view；≠ sync                                                                                                                |
| connectivity          | 连接状态         | Network / Habitat link UI（`ShellConnectivityBar`）；≠ outbox                                                                                               |
| LLM Format            | 格式             | Wire-protocol adapter id（`openai_compatible` / `openai_responses` / `anthropic_messages`）；config field `format`；code `LlmBackend`                       |
| LLM Preset            | 预设             | Built-in connection recipe（`deepseek` / `openrouter` / `opencode_go` / `custom`）；single-format or multi-format gateway；**no** built-in openai           |
| LLM Connection        | 连接             | User-configured entry under `llm.providers.<id>`（credentials + preset/format）；UI「连接」；code still `LlmProvider`；密钥明文或 `vault`/`env`，无自动掩码 |
| LLM Profile           | 场景             | `llm.profiles.<id>` scene routing + chain failover；callers bind profile ids                                                                                |
| single-format preset  | 单格式预设       | Fixed `format` + default `base_url`（e.g. DeepSeek / OpenRouter）                                                                                           |
| gateway preset        | 多格式网关预设   | Fixed `base_url` + key；**format chosen per model**（e.g. OpenCode Go）                                                                                     |
