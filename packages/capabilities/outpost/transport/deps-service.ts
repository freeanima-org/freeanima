import { Context, Service } from "cordis";

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

let current: RemoteToolsDepsService | null = null;
let ownedCtx: Context | null = null;

/** 模块内单例（不再查进程根 context）。 */
export function ensureRemoteToolsDepsService(): RemoteToolsDepsService {
  if (!current) {
    ownedCtx ??= new Context();
    current = new RemoteToolsDepsService(ownedCtx);
  }
  return current;
}

export function currentRemoteToolsDepsService(): RemoteToolsDepsService | null {
  return current;
}

/** Test teardown。 */
export function resetRemoteToolsDepsServiceForTest(): void {
  current = null;
  ownedCtx = null;
}
