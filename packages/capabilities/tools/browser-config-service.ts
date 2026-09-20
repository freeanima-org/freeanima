import { Context, Service } from "cordis";
import type { Config } from "@freeanima/core/config";

declare module "cordis" {
  interface Context {
    browserToolsConfig: BrowserToolsConfigService;
  }
}

/**
 * Cordis service (`ctx.browserToolsConfig`) holding the browser tools config
 * bound at registration. Replaces the module-level singleton in
 * `tools/browser-camofox.ts`.
 */
export class BrowserToolsConfigService extends Service {
  private config: Config | null = null;

  constructor(ctx: Context) {
    super(ctx, "browserToolsConfig");
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

let current: BrowserToolsConfigService | null = null;
let ownedCtx: Context | null = null;

/** 模块内单例（不再查进程根 context）。 */
export function ensureBrowserToolsConfigService(): BrowserToolsConfigService {
  if (!current) {
    ownedCtx ??= new Context();
    current = new BrowserToolsConfigService(ownedCtx);
  }
  return current;
}

export function currentBrowserToolsConfigService(): BrowserToolsConfigService | null {
  return current;
}

/** Test teardown。 */
export function resetBrowserToolsConfigServiceForTest(): void {
  current = null;
  ownedCtx = null;
}
