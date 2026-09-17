import { Service, type Context } from "cordis";
import type { RuntimeConfigApplyDeps } from "./register-runtime-applies.ts";

declare module "cordis" {
  interface Context {
    runtimeConfigApplyDeps: RuntimeConfigApplyDepsService;
  }
}

/**
 * Cordis service (`ctx.runtimeConfigApplyDeps`) holding the hot-apply
 * dependencies bound by the composition root once engine / HTTP are ready.
 * Replaces the module-level singleton in `config/register-runtime-applies.ts`.
 */
export class RuntimeConfigApplyDepsService extends Service {
  private deps: RuntimeConfigApplyDeps = {};

  constructor(ctx: Context) {
    super(ctx, "runtimeConfigApplyDeps");
  }

  merge(next: RuntimeConfigApplyDeps): void {
    this.deps = { ...this.deps, ...next };
  }

  get(): RuntimeConfigApplyDeps {
    return this.deps;
  }

  reset(): void {
    this.deps = {};
  }
}

/** Mount synchronously (idempotent: re-mounting reuses the existing instance). */
export function mountRuntimeConfigApplyDepsService(ctx: Context): RuntimeConfigApplyDepsService {
  const existing = ctx.runtimeConfigApplyDeps as RuntimeConfigApplyDepsService | undefined;
  if (existing) return existing;
  return new RuntimeConfigApplyDepsService(ctx);
}
