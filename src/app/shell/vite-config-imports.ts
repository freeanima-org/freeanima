/** Vite 配置专用 re-export：Node 加载 vite.config.ts 时不识别 tsconfig paths，此处用 ≤2 级相对路径。 */
export { createComponentBuildMeta, isShipChannel } from "../../core/config/build-meta.ts";
export type { BuildChannel, ComponentBuildMeta } from "../../core/config/build-meta.ts";
export { resolveHubRpcWsUrl } from "../../shared/hub-rpc/urls.ts";
export { nativeBuildMetaDefine } from "../../frontend/shell-sdk/native-build-meta.ts";
export { shellEntryFileNames } from "../../frontend/shell-ui/vite/entry-file-names.ts";
export { createShellViteInlineConfig } from "../../frontend/shell-ui/vite/run-build.ts";
export { shellBridgeHtmlPlugin } from "../../frontend/shell-ui/vite/shell-bridge-html.ts";
export {
  createHubDevProxyMap,
  quietBenignWsProxyErrorsPlugin,
  resolveProxyHubUrl,
} from "./hub-dev-proxy.ts";
