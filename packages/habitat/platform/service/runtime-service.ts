import { Service, type Context } from "cordis";
import type { Kernel } from "@freeanima/habitat/kernel";
import type { AppRuntime } from "./app-runtime.ts";
import type { FullRuntimeDeps } from "./runtime-deps.ts";

declare module "cordis" {
  interface Context {
    appRuntime: RuntimeService;
  }
}

/** Process-level runtime: deps + app + kernel, owned by the Cordis context. */
export type RuntimeContext = {
  deps: FullRuntimeDeps;
  app: ServiceAppRuntime;
  kernel: Kernel;
};

export type ServiceAppRuntime = AppRuntime & { kernel: Kernel };

/**
 * Cordis service exposing the runtime as `ctx.runtime`.
 *
 * Mounted on `kernel.ctx` at `initRuntimeContext`; Cordis-aware consumers can
 * `ctx.inject(['runtime'], ...)` instead of reaching for the global accessor.
 */
export class RuntimeService extends Service {
  readonly deps: FullRuntimeDeps;
  readonly app: ServiceAppRuntime;
  readonly kernel: Kernel;

  constructor(ctx: Context, config: { runtime: RuntimeContext }) {
    super(ctx, "appRuntime");
    this.deps = config.runtime.deps;
    this.app = config.runtime.app;
    this.kernel = config.runtime.kernel;
  }
}
