import { Service, type Context } from "cordis";
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

/** Mount synchronously (idempotent: re-mounting reuses the existing instance). */
export function mountWebToolsConfigService(ctx: Context): WebToolsConfigService {
  const existing = ctx.webToolsConfig as WebToolsConfigService | undefined;
  if (existing) return existing;
  return new WebToolsConfigService(ctx);
}
