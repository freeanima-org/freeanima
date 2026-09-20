import { setAppRuntimePort } from "@freeanima/capabilities/ports/app-runtime-context";

import {
  mountRuntimeService,
  type RuntimeContext,
  type ServiceAppRuntime,
} from "./runtime-service.ts";
import type { FullRuntimeDeps } from "@freeanima/capabilities/ports/runtime-deps.ts";

export type { RuntimeContext, ServiceAppRuntime } from "./runtime-service.ts";

let current: RuntimeContext | null = null;

/**
 * Runtime context handle.
 *
 * 组合根在 boot 时登记（`initRuntimeContext`）：模块内句柄 + 能力层端口同时写入，
 * 深层消费者不再查进程根 context；需要 ctx 的消费方仍可用 `ctx.appRuntime`。
 */
export function initRuntimeContext(runtime: ServiceAppRuntime): void {
  const ctx: RuntimeContext = {
    deps: runtime.fullDeps(),
    app: runtime,
    kernel: runtime.kernel,
  };
  mountRuntimeService(runtime.kernel.ctx, ctx);
  current = ctx;
  setAppRuntimePort({ app: runtime, deps: ctx.deps });
}

function runtimeContext(): RuntimeContext | null {
  return current;
}

export function getRuntimeContext(): RuntimeContext {
  const service = runtimeContext();
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
  return runtimeContext() !== null;
}

/** Test teardown。 */
export function resetRuntimeContextForTest(): void {
  current = null;
  setAppRuntimePort(null);
}
