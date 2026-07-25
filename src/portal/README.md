# Portal（入口）

产品上 Portal = 进入 Habitat 的类；实现按**形态**分目录。术语见 [`i18n/glossary.md`](../../i18n/glossary.md)、[`docs/modules/portal.md`](../../docs/modules/portal.md)。

| 形态   | form          | 本目录       | 说明                                                                                            |
| ------ | ------------- | ------------ | ----------------------------------------------------------------------------------------------- |
| 应用   | `application` | `app/`       | Shell（Tauri / Web 整窗 SPA）                                                                   |
| 浏览器 | `browser`     | `extension/` | 浏览器扩展（MV3）                                                                               |
| CLI    | `cli`         | `cli/`       | `anima` CLI                                                                                     |
| MCP    | `mcp`         | —            | **实现在** `src/host/capabilities/mcp-server/`（Habitat `/mcp`）；不宜迁入本树（host ↛ portal） |

`mcp-client` 是 Habitat **出站**连外部 MCP，**不是**入口形态。
