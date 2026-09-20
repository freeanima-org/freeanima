import { Context, Service } from "cordis";
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

let current: ClarifyConfigService | null = null;
let ownedCtx: Context | null = null;

/** 模块内单例（不再查进程根 context）。 */
export function ensureClarifyConfigService(): ClarifyConfigService {
  if (!current) {
    ownedCtx ??= new Context();
    current = new ClarifyConfigService(ownedCtx);
  }
  return current;
}

export function currentClarifyConfigService(): ClarifyConfigService | null {
  return current;
}

/** Test teardown。 */
export function resetClarifyConfigServiceForTest(): void {
  current = null;
  ownedCtx = null;
}
