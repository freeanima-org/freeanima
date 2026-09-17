export {
  initRuntimeContext,
  getRuntimeContext,
  getAppRuntime,
  getRuntimeDeps,
  isRuntimeContextReady,
  type RuntimeContext,
  type ServiceAppRuntime,
} from "./service/runtime-context.ts";

export { RuntimeService } from "./service/runtime-service.ts";

export { assertNotShuttingDown } from "@freeanima/server/ports/app-runtime-context";

export type { AppRuntime } from "./service/index.ts";
export type { Engine } from "@freeanima/engine";
