import { Context, Service } from "cordis";

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

let current: FederationManagerService | null = null;
let ownedCtx: Context | null = null;

/** 模块内单例（不再查进程根 context）。 */
export function ensureFederationManagerService(): FederationManagerService {
  if (!current) {
    ownedCtx ??= new Context();
    current = new FederationManagerService(ownedCtx);
  }
  return current;
}

export function currentFederationManagerService(): FederationManagerService | null {
  return current;
}

/** Test teardown。 */
export function resetFederationManagerServiceForTest(): void {
  current = null;
  ownedCtx = null;
}
