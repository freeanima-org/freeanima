/** Vite 配置专用 re-export：Node 加载 vite.config.ts 时不识别 tsconfig paths，此处用 ≤2 级相对路径。 */
export {
  createComponentBuildMeta,
  isShipChannel,
  resolveHabitatRpcWsUrl,
} from "../vite-config-cross-pkg.ts";
export type { BuildChannel, ComponentBuildMeta } from "../vite-config-cross-pkg.ts";
export { nativeBuildMetaDefine } from "../../client/portal-sdk/native-build-meta.ts";
export {
  parseShellBuildTarget,
  shellWebDistDirName,
} from "../../client/portal-sdk/shell-build-target.ts";
export { shellEntryFileNames } from "../../client/app-frame/vite/entry-file-names.ts";
export { createShellViteInlineConfig } from "../../client/app-frame/vite/run-build.ts";
export { shellBridgeHtmlPlugin } from "../../client/app-frame/vite/shell-bridge-html.ts";
export {
  createHabitatDevProxyMap,
  quietBenignWsProxyErrorsPlugin,
  resolveProxyHabitatUrl,
} from "./habitat-dev-proxy.ts";
