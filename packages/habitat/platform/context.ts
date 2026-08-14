export {
  initRuntimeContext,
  getRuntimeContext,
  getAppRuntime,
  getRuntimeDeps,
  isRuntimeContextReady,
  type RuntimeContext,
  type ServiceAppRuntime,
} from "./service/runtime-context.ts";

export { assertNotShuttingDown } from "@freeanima/habitat/platform/ports/app-runtime-context";

export type { AppRuntime } from "./service/index.ts";
export type { Engine } from "@freeanima/habitat/engine";
