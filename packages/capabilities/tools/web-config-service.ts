import { Context, Service } from "cordis";
import type { Config } from "@freeanima/core/config";

declare module "cordis" {
  interface Context {
    webToolsConfig: WebToolsConfigService;
  }
}

/**
 * Cordis service (`ctx.webToolsConfig`) holding the web tools config bound at
 * registration. Replaces the module-level singleton in `tools/web.ts`.
 */
export class WebToolsConfigService extends Service {
  private config: Config | null = null;

  constructor(ctx: Context) {
    super(ctx, "webToolsConfig");
  }

  set(config: Config): void {
    this.config = config;
  }

  get(): Config | null {
    return this.config;
  }

  reset(): void {
    this.config = null;
  }
}

let current: WebToolsConfigService | null = null;
let ownedCtx: Context | null = null;

/** 模块内单例（不再查进程根 context）。 */
export function ensureWebToolsConfigService(): WebToolsConfigService {
  if (!current) {
    ownedCtx ??= new Context();
    current = new WebToolsConfigService(ownedCtx);
  }
  return current;
}

export function currentWebToolsConfigService(): WebToolsConfigService | null {
  return current;
}

/** Test teardown。 */
export function resetWebToolsConfigServiceForTest(): void {
  current = null;
  ownedCtx = null;
}
