import { Service, type Context } from "cordis";
import type { Config } from "@freeanima/habitat/core/config";

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

/** Mount synchronously (idempotent: re-mounting reuses the existing instance). */
export function mountBrowserToolsConfigService(ctx: Context): BrowserToolsConfigService {
  const existing = ctx.browserToolsConfig as BrowserToolsConfigService | undefined;
  if (existing) return existing;
  return new BrowserToolsConfigService(ctx);
}
