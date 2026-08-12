# Code layers and dependencies

> **Repository** layering（≠ 认知 Consciousness/Self/Memory/Estate）。**文档 + `scripts/check-layer-deps.ts` + tsconfig paths** 把关。

## Layer topology

Host 纵向栈（高 → 低）：

```
portal/cli → platform → capabilities → engine → core → kernel
```

并列轴：

| Directory       | Import prefix                                                | Role                                         |
| --------------- | ------------------------------------------------------------ | -------------------------------------------- |
| `src/shared/`   | `@freeanima/shared/...`                                      | 协议 / 加密（**无 React**）                  |
| `src/ui-kit/`   | `@freeanima/ui-kit`                                          | 设计系统（与 shared 并列；仅 client 消费者） |
| `src/client/`   | `@freeanima/client/{portal-sdk,app-frame}`                   | Portal chrome                                |
| `src/features/` | `@freeanima/features/{slug}/`                                | 产品纵向模块                                 |
| `src/host/`     | `@freeanima/host/{kernel,core,engine,capabilities,platform}` | Habitat 进程                                 |

| Layer            | Directory                | Responsibility                                                                         |
| ---------------- | ------------------------ | -------------------------------------------------------------------------------------- |
| **kernel**       | `src/host/kernel/`       | HookRegistry (`on`/`subscribe`), logging                                               |
| **core**         | `src/host/core/`         | PG、Redis 原语（cache/kv/lock）、config、capability-policy、时区、tool/LLM 原语、skill |
| **engine**       | `src/host/engine/`       | conversation、turn、loop、goal、pipeline（原 `runtime/`）                              |
| **capabilities** | `src/host/capabilities/` | self、memory、tools（含 slash-commands）、outpost、connectors、acp、mcp-*、llm-openai  |
| **platform**     | `src/host/platform/`     | 组合根；`service/` = AppRuntime（原 `platform/runtime/`）                              |
| **ui-kit**       | `src/ui-kit/`            | React 设计系统                                                                         |
| **client**       | `src/client/`            | portal-sdk、app-frame                                                                  |
| **portal**       | `src/portal/`            | 入口：`app`（Shell）/ `extension` / `cli`；MCP 形态在 host `mcp-server`                |

### Feature 模块

内置 plugin：`src/host/platform/features/builtin-plugins.ts`。Habitat RPC：`features/*/habitat/routes`。**Habitat 管理台是普通 feature**，无特殊栈。

### Client 消环

```
app-frame → features/*/ui → { ui-kit, portal-sdk } → shared
```

- Feature UI **禁止** import app-frame / platform / engine / capabilities
- Typed Habitat client：`@freeanima/client/portal-sdk/habitat-typed-client`
- Display/snapshot 类型：`@freeanima/shared/rpc-contract/frames/{display,snapshot}`

## Dependency matrix（摘要）

| Source                | Allowed                                                | Forbidden                                           |
| --------------------- | ------------------------------------------------------ | --------------------------------------------------- |
| `host/kernel`         | kernel                                                 | 其它                                                |
| `host/core`           | kernel, core                                           | engine+                                             |
| `host/engine`         | kernel, core, engine                                   | platform, capabilities                              |
| `host/capabilities/*` | kernel, core, own pack, shared 契约                    | platform, features, other capabilities*, engine     |
| `host/platform`       | 全 host + features（注册）                             | ui-kit / client（除 habitat client 过渡 re-export） |
| `features/*/ui`       | ui-kit, portal-sdk, shared, host/core（工具/类型暂准） | platform, engine, capabilities, app-frame           |
| `ui-kit`              | kernel（极少）                                         | features, host, client                              |
| `shared`              | kernel, shared                                         | ui-kit, client, React                               |

**CI**：`just qa check` 跑 `bun scripts/check-layer-deps.ts`。

## Port binding

Boot：`src/host/platform/boot/`。入口：`src/host/platform/serve.ts`。

## Runtime Catalog

禁止模块级 registry 单例。Capabilities 访问 PG：`@freeanima/host/core/db/pg/*`。
