import { Context, Service } from "cordis";
import type { RetainEngineFn } from "./retain-engine-port.ts";

declare module "cordis" {
  interface Context {
    retainEngine: RetainEngineService;
  }
}

/**
 * Cordis service (`ctx.retainEngine`) holding the retain engine override.
 * Replaces the module-level singleton in `memory/service/retain-engine-port.ts`.
 */
export class RetainEngineService extends Service {
  private fn: RetainEngineFn | null = null;

  constructor(ctx: Context) {
    super(ctx, "retainEngine");
  }

  register(fn: RetainEngineFn): void {
    this.fn = fn;
  }

  get(): RetainEngineFn | null {
    return this.fn;
  }

  reset(): void {
    this.fn = null;
  }
}

let current: RetainEngineService | null = null;
let ownedCtx: Context | null = null;

/** 模块内单例（不再查进程根 context）。 */
export function ensureRetainEngineService(): RetainEngineService {
  if (!current) {
    ownedCtx ??= new Context();
    current = new RetainEngineService(ownedCtx);
  }
  return current;
}

export function currentRetainEngineService(): RetainEngineService | null {
  return current;
}

/** Test teardown。 */
export function resetRetainEngineServiceForTest(): void {
  current = null;
  ownedCtx = null;
}
