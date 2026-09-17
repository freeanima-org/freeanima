import { Service, type Context } from "cordis";

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

/** Mount synchronously (idempotent: re-mounting reuses the existing instance). */
export function mountFederationHubWsService(ctx: Context): FederationHubWsService {
  const existing = ctx.federationHubWs as FederationHubWsService | undefined;
  if (existing) return existing;
  return new FederationHubWsService(ctx);
}
