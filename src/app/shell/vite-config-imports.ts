/** Vite 配置专用 re-export：Node 加载 vite.config.ts 时不识别 tsconfig paths，此处用 ≤2 级相对路径。 */
export { createComponentBuildMeta, isShipChannel } from "../../core/config/build-meta.ts";
export type { BuildChannel, ComponentBuildMeta } from "../../core/config/build-meta.ts";
export { resolveHabitatRpcWsUrl } from "../../shared/habitat-rpc/urls.ts";
export { nativeBuildMetaDefine } from "../../frontend/portal-sdk/native-build-meta.ts";
export {
  parseShellBuildTarget,
  shellWebDistDirName,
} from "../../frontend/portal-sdk/shell-build-target.ts";
export { shellEntryFileNames } from "../../frontend/app-ui/vite/entry-file-names.ts";
export { createShellViteInlineConfig } from "../../frontend/app-ui/vite/run-build.ts";
export { shellBridgeHtmlPlugin } from "../../frontend/app-ui/vite/shell-bridge-html.ts";
export {
  createHabitatDevProxyMap,
  quietBenignWsProxyErrorsPlugin,
  resolveProxyHabitatUrl,
} from "./habitat-dev-proxy.ts";
