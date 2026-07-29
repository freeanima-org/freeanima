---
title: Portal
---

# Portal（入口）

Portal 是进入 Habitat 的**类**；具体实现按**入口形态**区分。术语 SSOT：[`i18n/glossary.md`](../../i18n/glossary.md)、[`docs/product/architecture.md`](../product/architecture.md) Product naming。

## 四种形态

| 形态       | form id       | 用户侧实现                                  | 代码                                                       |
| ---------- | ------------- | ------------------------------------------- | ---------------------------------------------------------- |
| **应用**   | `application` | Shell（壳）：桌面 / 移动 / **Web 整窗 SPA** | `src/portal/app/{tauri,web}`                               |
| **浏览器** | `browser`     | 浏览器扩展（MV3）                           | `src/portal/extension`                                     |
| **MCP**    | `mcp`         | Habitat 对外 `/mcp`                         | `src/host/capabilities/mcp-server`（**不**迁入 `portal/`） |
| **CLI**    | `cli`         | `anima` CLI（service / token / 运维）       | `src/portal/cli`                                           |

- **Web 壳 = 应用形态**（标签页里的整窗 SPA），**不是**浏览器形态。
- **浏览器形态** = 扩展运行时（popup / content script / background）。
- **MCP 形态**产品上算入口；进程上挂在 Habitat 组合根。整包迁入 `portal/` 会迫使 host → portal，违反层边界。`mcp-client` 是出站工具接入，**不是**入口。
- **Outpost / Gateway** 不是 Portal（见 glossary）。

## 目录约定

```
src/portal/
  app/           # 应用形态（Shell）
  extension/     # 浏览器形态
    entrypoints/
    runtime/     # settings、Habitat HTTP client、消息信封
    features/    # 按能力拆分（本期 vault）
  cli/           # CLI 形态
```

壳内 SPA chrome（Rail / 设置）在 `src/client/`，**不是** `portal/` 根。

## 浏览器形态（扩展）

- 构建：`just pack browser-extension` → `dist/browser-extension/chrome-mv3`
- 开发：`just dev browser-extension`
- 鉴权：选项页填写 Habitat URL + Service API Token（Bearer）；RPC 仅 HTTP REST
- 能力（Vault）：见 [`vault.md`](vault.md)
- **UI 栈：** popup / options 与应用壳同栈（React + `@freeanima/ui-kit`）；编辑表单等与 Shell 共用 `features/vault/ui/shared`。content script 保持原生 DOM（页面注入，不适用 SPA UI 规范）。

## 相关

- 远程 Token：[`docs/ops/remote-access.md`](../ops/remote-access.md)
- 壳规则：[`.agent/rules/tauri-shell.md`](../../.agent/rules/tauri-shell.md)
- 仓库拓扑：[`.agent/rules/repository-topology.md`](../../.agent/rules/repository-topology.md)
