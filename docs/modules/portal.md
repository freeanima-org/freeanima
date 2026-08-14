---
title: 入口
---

# 入口（Portal）

入口是进入栖息地的**类**；具体实现按**入口形态**区分。术语
SSOT：[`i18n/glossary.md`](../../i18n/glossary.md)、[`docs/product/architecture.md`](../product/architecture.md)
产品命名。

## 四种形态

| 形态       | form id       | 用户侧实现                                  | 代码                                                               |
| ---------- | ------------- | ------------------------------------------- | ------------------------------------------------------------------ |
| **应用**   | `application` | Shell（壳）：桌面 / 移动 / **Web 整窗 SPA** | `packages/frontend/portal/app/{tauri,web}`                         |
| **浏览器** | `browser`     | 浏览器扩展（MV3）                           | `packages/frontend/portal/extension`                               |
| **MCP**    | `mcp`         | Habitat 对外 `/mcp`                         | `packages/habitat/capabilities/mcp-server`（**不**迁入 `portal/`） |
| **CLI**    | `cli`         | `anima` CLI（service / token / 运维）       | `packages/habitat/portal/cli`                                      |

- **Web 壳 = 应用形态**（标签页里的整窗 SPA），**不是**浏览器形态。
- **浏览器形态** = 扩展运行时（popup / content script / background）。
- **MCP 形态**产品上算入口；进程上挂在 Habitat 组合根。整包迁入 `portal/` 会迫使 host →
  portal，违反层边界。`mcp-client` 是出站工具接入，**不是**入口。
- **Outpost / Gateway** 不是 Portal（见 glossary）。

## 目录约定

```
src/portal/
  app/           # 应用形态（Shell）
  extension/     # 浏览器形态
    entrypoints/
    runtime/     # settings、Habitat HTTP client、消息信封
    features/    # 按能力：vault / bookmarks；规划 clipper
  cli/           # CLI 形态
```

壳内 SPA chrome（Rail / 设置）在 `packages/frontend/client/`，**不是** `portal/` 根。

## 浏览器形态（扩展）

浏览器形态入口 = **一个** MV3 扩展（展示名 **FreeAnima** / 本地 **FreeAnima Local**），直连栖息地；不是「保险库专用插件」。Vault、规划中的书签同步与网页剪藏均作为扩展内能力模块。

- 代码：`packages/frontend/portal/extension`（WXT MV3；React popup/options + `runtime/` + `features/*`；图标 `public/icon-*.png`）
- 构建（Chrome）：`just pack browser-extension-chrome` → `dist/browser-extension/chrome-mv3` + zip
- 构建（Firefox 维护者 canary）：`just pack browser-extension-firefox` → 签名/未签名 xpi + updates.json
- 开发：`just dev browser-extension-chrome` / `just dev browser-extension-firefox`
- 鉴权：选项页填写 Habitat URL + Service API Token（Bearer）；RPC 仅 HTTP REST（background）
- **UI 栈：** popup / options 与应用壳同栈（React + `@freeanima/ui-kit`）；Vault 编辑表单与 Shell 共用 `features/vault/ui/shared`。content script 保持原生 DOM。

### 能力

| 能力            | 状态 | 说明                                                                          |
| --------------- | ---- | ----------------------------------------------------------------------------- |
| Vault（保险库） | 现行 | 自动填充、弹窗 CRUD、保存提示、密码生成等 — 行为细节见 [`vault.md`](vault.md) |
| 书签同步        | 现行 | 扩展内模块；独立 `bookmark` entity；双向同步见 [`bookmark.md`](bookmark.md)   |
| 网页剪藏        | 规划 | 扩展内模块；独立 entity，不塞 `vault_item`                                    |

### Firefox（维护者自托管 canary）

- gecko id：`extension@freeanima.com`（对齐 `packages/frontend/portal/extension`；**变更 id = 新扩展**，已装旧 id 须卸旧装新并重配连接）
- 安装：从 GitHub canary Release 下载 `freeanima-browser-extension-firefox.xpi`；之后由
  `https://freeanima.com/extension/firefox/updates.json` 指向同一 Release 固定资产名自动升级
- 签名：需 `FREEANIMA_AMO_API_KEY` / `FREEANIMA_AMO_API_SECRET`（AMO unlisted）；未配置时仅能 `about:debugging` 临时加载 — 见 [`.github/SECRETS.md`](../../.github/SECRETS.md)
- `manifest.version`：由完整构建串收成 AMO 点分整数（第 4 段为 UTC Unix 分钟，每段 ≤9 位）— 见 `resolveFirefoxAddonVersion`

Chrome：开发者模式加载 `dist/browser-extension/chrome-mv3`；Release zip；**无**商店 OTA。

## 相关

- Vault 在扩展内的行为：[`vault.md`](vault.md)
- 远程 Token：[`docs/ops/remote-access.md`](../ops/remote-access.md)
- 壳规则：[`.cursor/rules/tauri-shell.mdc`](../../.cursor/rules/tauri-shell.mdc)
- 仓库拓扑：[`.cursor/rules/repository-topology.mdc`](../../.cursor/rules/repository-topology.mdc)
