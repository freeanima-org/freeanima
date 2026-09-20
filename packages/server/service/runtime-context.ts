import { getRootContextOrNull } from "@freeanima/kernel";

import {
  mountRuntimeService,
  RuntimeService,
  type RuntimeContext,
  type ServiceAppRuntime,
} from "./runtime-service.ts";
import type { FullRuntimeDeps } from "@freeanima/capabilities/ports/runtime-deps.ts";

export type { RuntimeContext, ServiceAppRuntime } from "./runtime-service.ts";

/**
 * Runtime context handle.
 *
 * The Cordis `appRuntime` service is the single source of truth (mounted by
 * {@link initRuntimeContext}); the previous module + process-global duality
 * (a `Symbol.for` registry mirror) is gone.
 */
export function initRuntimeContext(runtime: ServiceAppRuntime): void {
  const ctx: RuntimeContext = {
    deps: runtime.fullDeps(),
    app: runtime,
    kernel: runtime.kernel,
  };
  mountRuntimeService(runtime.kernel.ctx, ctx);
}

function runtimeService(): RuntimeService | null {
  const ctx = getRootContextOrNull();
  if (!ctx) return null;
  const service: unknown = ctx.reflect.get("appRuntime", false);
  return service instanceof RuntimeService ? service : null;
}

export function getRuntimeContext(): RuntimeContext {
  const service = runtimeService();
  if (!service) {
    throw new Error("RuntimeContext not initialized; call serve() first");
  }
  return { deps: service.deps, app: service.app, kernel: service.kernel };
}

export function getAppRuntime(): ServiceAppRuntime {
  return getRuntimeContext().app;
}

export function getRuntimeDeps(): FullRuntimeDeps {
  return getRuntimeContext().deps;
}

export function isRuntimeContextReady(): boolean {
  return runtimeService() !== null;
}
