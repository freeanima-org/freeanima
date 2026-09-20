import { Context, Service } from "cordis";
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

let current: RuntimeConfigApplyDepsService | null = null;
let ownedCtx: Context | null = null;

/** 模块内单例（不再查进程根 context）。 */
export function ensureRuntimeConfigApplyDepsService(): RuntimeConfigApplyDepsService {
  if (!current) {
    ownedCtx ??= new Context();
    current = new RuntimeConfigApplyDepsService(ownedCtx);
  }
  return current;
}

export function currentRuntimeConfigApplyDepsService(): RuntimeConfigApplyDepsService | null {
  return current;
}

/** Test teardown。 */
export function resetRuntimeConfigApplyDepsServiceForTest(): void {
  current = null;
  ownedCtx = null;
}
