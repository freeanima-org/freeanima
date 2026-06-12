export {
  initRuntimeContext,
  getRuntimeContext,
  getAppRuntime,
  getRuntimeDeps,
  isRuntimeContextReady,
  type RuntimeContext,
  type ServiceAppRuntime,
} from "./runtime/runtime-context.ts";

/** @deprecated 使用 getAppRuntime */
export { getAppRuntime as getServiceContext } from "./runtime/runtime-context.ts";

/** @deprecated 使用 initRuntimeContext */
export { initRuntimeContext as initAppRuntime } from "./runtime/runtime-context.ts";
export { initRuntimeContext as initServiceContext } from "./runtime/runtime-context.ts";

/** @deprecated 使用 isRuntimeContextReady */
export { isRuntimeContextReady as isAppRuntimeReady } from "./runtime/runtime-context.ts";
export { isRuntimeContextReady as isServiceContextReady } from "./runtime/runtime-context.ts";

export { assertNotShuttingDown } from "@freeanima/service-api/app-runtime-context";

export type { AppRuntime } from "./runtime/index.ts";
export type { Engine } from "@freeanima/orchestration-runtime";
export type { MaskRegistry } from "@freeanima/capabilities-mask";
export type { ServiceAppRuntime as ServiceContext } from "./runtime/runtime-context.ts";
