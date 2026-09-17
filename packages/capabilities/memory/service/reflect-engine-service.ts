import { Service, type Context } from "cordis";
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

/** Mount synchronously (idempotent: re-mounting reuses the existing instance). */
export function mountReflectEngineService(ctx: Context): ReflectEngineService {
  const existing = ctx.reflectEngine as ReflectEngineService | undefined;
  if (existing) return existing;
  return new ReflectEngineService(ctx);
}
