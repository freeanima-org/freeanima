export {
  initRuntimeContext,
  getRuntimeContext,
  getAppRuntime,
  getRuntimeDeps,
  isRuntimeContextReady,
  type RuntimeContext,
  type ServiceAppRuntime,
} from "./runtime/runtime-context.ts";

export { assertNotShuttingDown } from "@freeanima/platform/ports/app-runtime-context";

export type { AppRuntime } from "./runtime/index.ts";
export type { Engine } from "@freeanima/runtime";
export type { MaskRegistry } from "@freeanima/capabilities-task/mask";
