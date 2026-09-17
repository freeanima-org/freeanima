import { Service, type Context } from "cordis";

import type { RemoteToolsServerDeps } from "./ws-server.ts";

declare module "cordis" {
  interface Context {
    remoteToolsDeps: RemoteToolsDepsService;
  }
}

/**
 * Cordis service (`ctx.remoteToolsDeps`) holding the Remote Tools server
 * composition deps. Replaces the module-level singleton in
 * `outpost/transport/runtime-context.ts`.
 */
export class RemoteToolsDepsService extends Service {
  private deps: RemoteToolsServerDeps | null = null;

  constructor(ctx: Context) {
    super(ctx, "remoteToolsDeps");
  }

  set(deps: RemoteToolsServerDeps): void {
    this.deps = deps;
  }

  get(): RemoteToolsServerDeps | null {
    return this.deps;
  }

  clear(): void {
    this.deps = null;
  }
}

/** Mount synchronously (idempotent: re-mounting reuses the existing instance). */
export function mountRemoteToolsDepsService(ctx: Context): RemoteToolsDepsService {
  const existing = ctx.remoteToolsDeps as RemoteToolsDepsService | undefined;
  if (existing) return existing;
  return new RemoteToolsDepsService(ctx);
}
