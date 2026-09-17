import { Service, type Context } from "cordis";
import type { Config } from "@freeanima/core/config";

declare module "cordis" {
  interface Context {
    clarifyConfig: ClarifyConfigService;
  }
}

/**
 * Cordis service (`ctx.clarifyConfig`) holding the clarify tool config bound
 * by `registerClarifyHooks`. Replaces the module-level singleton in
 * `clarify/clarify.ts`.
 */
export class ClarifyConfigService extends Service {
  private config: Config | null = null;

  constructor(ctx: Context) {
    super(ctx, "clarifyConfig");
  }

  set(config: Config): void {
    this.config = config;
  }

  reset(): void {
    this.config = null;
  }

  require(): Config {
    if (!this.config) {
      throw new Error("Clarify config not bound; call registerClarifyHooks first");
    }
    return this.config;
  }
}

/** Mount synchronously (idempotent: re-mounting reuses the existing instance). */
export function mountClarifyConfigService(ctx: Context): ClarifyConfigService {
  const existing = ctx.clarifyConfig as ClarifyConfigService | undefined;
  if (existing) return existing;
  return new ClarifyConfigService(ctx);
}
