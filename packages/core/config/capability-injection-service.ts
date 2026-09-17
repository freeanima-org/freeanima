import { Service, type Context } from "cordis";
import type { CapabilityInjection } from "./capability-injection.ts";

declare module "cordis" {
  interface Context {
    capabilityInjection: CapabilityInjectionService;
  }
}

/**
 * Cordis service (`ctx.capabilityInjection`) holding the composition-root
 * wiring for capabilities (vault / app version). Replaces the module-level
 * singleton in `config/capability-injection.ts`.
 */
export class CapabilityInjectionService extends Service {
  private injection: CapabilityInjection = {};

  constructor(ctx: Context) {
    super(ctx, "capabilityInjection");
  }

  register(next: CapabilityInjection): void {
    this.injection = { ...this.injection, ...next };
  }

  get(): CapabilityInjection {
    return this.injection;
  }

  reset(): void {
    this.injection = {};
  }
}

/** Mount synchronously (idempotent: re-mounting reuses the existing instance). */
export function mountCapabilityInjectionService(ctx: Context): CapabilityInjectionService {
  const existing = ctx.capabilityInjection as CapabilityInjectionService | undefined;
  if (existing) return existing;
  return new CapabilityInjectionService(ctx);
}
