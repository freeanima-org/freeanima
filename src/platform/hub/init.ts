import { installHubMethodRegistry } from "@freeanima/shared/hub-contract/registry/runtime.ts";

import { hubRouter } from "./hub-router.ts";
import { resetCompiledHttpRoutes, compileHttpRoutesFromRegistry } from "./http-rest-router.ts";

let initialized = false;

/** Hub boot：安装 method registry 并编译 HTTP REST 路由表 */
export function initHubRouter(): void {
  if (initialized) return;
  installHubMethodRegistry(hubRouter.defs);
  resetCompiledHttpRoutes();
  compileHttpRoutesFromRegistry();
  initialized = true;
}

export function resetHubRouterForTests(): void {
  initialized = false;
}

export { hubRouter };
