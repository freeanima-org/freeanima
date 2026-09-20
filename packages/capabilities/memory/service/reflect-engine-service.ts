import { Context, Service } from "cordis";
import type { ReflectEngineFn } from "./reflect.ts";

declare module "cordis" {
  interface Context {
    reflectEngine: ReflectEngineService;
  }
}

/**
 * Cordis service (`ctx.reflectEngine`) holding the reflect engine override.
 * Replaces the module-level singleton in `memory/service/reflect.ts`.
 */
export class ReflectEngineService extends Service {
  private fn: ReflectEngineFn | null = null;

  constructor(ctx: Context) {
    super(ctx, "reflectEngine");
  }

  register(fn: ReflectEngineFn): void {
    this.fn = fn;
  }

  get(): ReflectEngineFn | null {
    return this.fn;
  }

  reset(): void {
    this.fn = null;
  }
}

let current: ReflectEngineService | null = null;
let ownedCtx: Context | null = null;

/** 模块内单例（不再查进程根 context）。 */
export function ensureReflectEngineService(): ReflectEngineService {
  if (!current) {
    ownedCtx ??= new Context();
    current = new ReflectEngineService(ownedCtx);
  }
  return current;
}

export function currentReflectEngineService(): ReflectEngineService | null {
  return current;
}

/** Test teardown。 */
export function resetReflectEngineServiceForTest(): void {
  current = null;
  ownedCtx = null;
}
