import { installHabitatMethodRegistry } from "@freeanima/shared/habitat-contract/registry/runtime.ts";

import { habitatRouter } from "./habitat-router.ts";
import { resetCompiledHttpRoutes, compileHttpRoutesFromRegistry } from "./http-rest-router.ts";

let initialized = false;

/** Habitat boot：安装 method registry 并编译 HTTP REST 路由表 */
export function initHabitatRouter(): void {
  if (initialized) return;
  installHabitatMethodRegistry(habitatRouter.defs);
  resetCompiledHttpRoutes();
  compileHttpRoutesFromRegistry();
  initialized = true;
}

export function resetHabitatRouterForTests(): void {
  initialized = false;
}

export { habitatRouter };
