import { installHubMethodRegistry } from "@freeanima/shared/habitat-contract/registry/runtime.ts";

import { habitatRouter, hubRouter } from "./habitat-router.ts";
import { resetCompiledHttpRoutes, compileHttpRoutesFromRegistry } from "./http-rest-router.ts";

let initialized = false;

/** Habitat boot：安装 method registry 并编译 HTTP REST 路由表 */
export function initHabitatRouter(): void {
  if (initialized) return;
  installHubMethodRegistry(habitatRouter.defs);
  resetCompiledHttpRoutes();
  compileHttpRoutesFromRegistry();
  initialized = true;
}

/** @deprecated 0.9.3 后删除 — 请用 initHabitatRouter */
export const initHubRouter = initHabitatRouter;

export function resetHabitatRouterForTests(): void {
  initialized = false;
}

/** @deprecated 0.9.3 后删除 — 请用 resetHabitatRouterForTests */
export const resetHubRouterForTests = resetHabitatRouterForTests;

export { habitatRouter, hubRouter };
