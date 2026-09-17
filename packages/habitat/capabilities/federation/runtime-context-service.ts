import { Service, type Context } from "cordis";

import type { FederationManager } from "./runtime-context.ts";

declare module "cordis" {
  interface Context {
    federationManager: FederationManagerService;
  }
}

/**
 * Cordis service (`ctx.federationManager`) holding the bound federation
 * manager. Replaces the module-level singleton in `runtime-context.ts`.
 */
export class FederationManagerService extends Service {
  private manager: FederationManager | null = null;

  constructor(ctx: Context) {
    super(ctx, "federationManager");
  }

  set(next: FederationManager | null): void {
    this.manager = next;
  }

  get(): FederationManager | null {
    return this.manager;
  }
}

/** Mount synchronously (idempotent: re-mounting reuses the existing instance). */
export function mountFederationManagerService(ctx: Context): FederationManagerService {
  const existing = ctx.federationManager as FederationManagerService | undefined;
  if (existing) return existing;
  return new FederationManagerService(ctx);
}
