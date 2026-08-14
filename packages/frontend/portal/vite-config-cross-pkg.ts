/** Vite 配置跨包 re-export：相对路径 ≤2 级，供 portal/app 再 re-export。 */
export { createComponentBuildMeta, isShipChannel } from "../../habitat/core/config/build-meta.ts";
export type { BuildChannel, ComponentBuildMeta } from "../../habitat/core/config/build-meta.ts";
export { resolveHabitatRpcWsUrl } from "../../shared/habitat-rpc/urls.ts";
