# Package naming (RFC #1)

> **单包 + Phase 1 host/client**：逻辑名经 `tsconfig` paths；物理根 `package.json`；拓扑见 [`repository-topology.md`](../.agent/rules/repository-topology.md)。

| Shape      | Pattern                                                    | Example                                                    |
| ---------- | ---------------------------------------------------------- | ---------------------------------------------------------- |
| Host layer | `@freeanima/host/{layer}`                                  | `host/kernel`, `host/core`, `host/engine`, `host/platform` |
| Capability | `@freeanima/host/capabilities/{slug}`                      | `self`, `memory`, `tools`, `outpost`, `connectors`, …      |
| Feature    | `@freeanima/features/{slug}/…`                             | `features/chat/…`                                          |
| Shared     | `@freeanima/shared/{name}`                                 | `habitat-rpc`, `rpc-contract`                              |
| UI kit     | `@freeanima/ui-kit`                                        | 设计系统（顶层，∥ shared）                                 |
| Client     | `@freeanima/client/{portal-sdk,app-frame}`                 | Portal chrome                                              |
| Entry      | `src/portal/cli`, `src/portal/app`, `src/portal/extension` | CLI / Portal 宿主 / Vault 浏览器扩展                       |

## Valid paths（摘要）

| Prefix                           | Notes                                                                                                         |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `@freeanima/host/kernel`         | logging, hooks（`on`/`subscribe`；legacy eventbus adapters）                                                  |
| `@freeanima/host/core`           | db、redis（cache/kv/lock）、config、capability-policy、i18n、tool、llm、skill、…                              |
| `@freeanima/host/engine`         | conversation, turn, loop, goal, pipeline（原 runtime）                                                        |
| `@freeanima/host/capabilities/*` | self（原 identity）、outpost（原 remote-tools）、connectors（原 platform/connectors）、tools(+slash-commands) |
| `@freeanima/host/platform`       | boot, ports, habitat router, `service/`（原 platform/runtime）                                                |
| `@freeanima/ui-kit`              | React 设计系统                                                                                                |
| `@freeanima/client/portal-sdk`   | Shell/Habitat 客户端 + typed client                                                                           |
| `@freeanima/client/app-frame`    | AppFrame SPA                                                                                                  |
| `@freeanima/shared/*`            | 无 React 契约                                                                                                 |

**Deprecated import prefixes**（勿在新代码使用）: `@freeanima/frontend/*`、`@freeanima/runtime`、`@freeanima/capabilities/identity`、`@freeanima/capabilities/remote-tools`、裸 `@freeanima/platform`（应 `@freeanima/host/platform`）、`@freeanima/core`（应 `@freeanima/host/core`）。

Layer rules: [`code-layers.md`](code-layers.md)。
