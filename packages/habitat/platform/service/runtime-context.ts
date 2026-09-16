import { registerAppRuntime } from "@freeanima/habitat/platform/ports/app-runtime-context";

import { RuntimeService, type RuntimeContext, type ServiceAppRuntime } from "./runtime-service.ts";
import type { FullRuntimeDeps } from "./runtime-deps.ts";

export type { RuntimeContext, ServiceAppRuntime } from "./runtime-service.ts";

const GLOBAL_KEY = Symbol.for("@freeanima/runtime-context");

type GlobalStore = typeof globalThis & { [GLOBAL_KEY]?: RuntimeContext };

let moduleCtx: RuntimeContext | undefined;

export function initRuntimeContext(runtime: ServiceAppRuntime): void {
  const ctx: RuntimeContext = {
    deps: runtime.fullDeps(),
    app: runtime,
    kernel: runtime.kernel,
  };
  moduleCtx = ctx;
  (globalThis as GlobalStore)[GLOBAL_KEY] = ctx;
  runtime.kernel.ctx.plugin(RuntimeService, { runtime: ctx });
  registerAppRuntime(runtime);
}

export function getRuntimeContext(): RuntimeContext {
  const ctx = moduleCtx ?? (globalThis as GlobalStore)[GLOBAL_KEY];
  if (!ctx) {
    throw new Error("RuntimeContext not initialized; call serve() first");
  }
  return ctx;
}

export function getAppRuntime(): ServiceAppRuntime {
  return getRuntimeContext().app;
}

export function getRuntimeDeps(): FullRuntimeDeps {
  return getRuntimeContext().deps;
}

export function isRuntimeContextReady(): boolean {
  return moduleCtx !== undefined || (globalThis as GlobalStore)[GLOBAL_KEY] !== undefined;
}
