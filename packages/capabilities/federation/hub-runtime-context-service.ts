import { Context, Service } from "cordis";

import type { FederationHubWsDeps } from "./hub-ws-server.ts";

declare module "cordis" {
  interface Context {
    federationHubWs: FederationHubWsService;
  }
}

/**
 * Cordis service (`ctx.federationHubWs`) holding the federation hub WS deps.
 * Replaces the module-level singleton in `hub-runtime-context.ts`.
 */
export class FederationHubWsService extends Service {
  private deps: FederationHubWsDeps | null = null;

  constructor(ctx: Context) {
    super(ctx, "federationHubWs");
  }

  set(next: FederationHubWsDeps): void {
    this.deps = next;
  }

  get(): FederationHubWsDeps | null {
    return this.deps;
  }
}

let current: FederationHubWsService | null = null;
let ownedCtx: Context | null = null;

/** 模块内单例（不再查进程根 context）。 */
export function ensureFederationHubWsService(): FederationHubWsService {
  if (!current) {
    ownedCtx ??= new Context();
    current = new FederationHubWsService(ownedCtx);
  }
  return current;
}

export function currentFederationHubWsService(): FederationHubWsService | null {
  return current;
}

/** Test teardown。 */
export function resetFederationHubWsServiceForTest(): void {
  current = null;
  ownedCtx = null;
}
