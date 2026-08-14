import type { AppRuntimePort } from "@freeanima/habitat/platform/ports/app-runtime-port";
import { registerAppRuntime } from "@freeanima/habitat/platform/ports/app-runtime-context";
import type { Kernel } from "@freeanima/habitat/kernel";

import type { AppRuntime } from "./app-runtime.ts";
import type { FullRuntimeDeps } from "./runtime-deps.ts";

const GLOBAL_KEY = Symbol.for("@freeanima/runtime-context");

type GlobalStore = typeof globalThis & { [GLOBAL_KEY]?: RuntimeContext };

/** 进程级运行时上下文：deps + app 单源 */
export type RuntimeContext = {
  deps: FullRuntimeDeps;
  app: AppRuntimePort;
  kernel: Kernel;
};

export type ServiceAppRuntime = AppRuntime & { kernel: Kernel };

let moduleCtx: RuntimeContext | undefined;

export function initRuntimeContext(runtime: ServiceAppRuntime): void {
  const ctx: RuntimeContext = {
    deps: runtime.fullDeps(),
    app: runtime,
    kernel: runtime.kernel,
  };
  moduleCtx = ctx;
  (globalThis as GlobalStore)[GLOBAL_KEY] = ctx;
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
  return getRuntimeContext().app as ServiceAppRuntime;
}

export function getRuntimeDeps(): FullRuntimeDeps {
  return getRuntimeContext().deps;
}

export function isRuntimeContextReady(): boolean {
  return moduleCtx !== undefined || (globalThis as GlobalStore)[GLOBAL_KEY] !== undefined;
}
