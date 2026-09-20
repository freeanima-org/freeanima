import { Context, Service } from "cordis";
import type { CronHandleManager } from "./handle-manager.ts";

declare module "cordis" {
  interface Context {
    cronHandleManager: CronHandleService;
  }
}

/**
 * Cordis service (`ctx.cronHandleManager`) holding the initialized cron handle
 * manager. Replaces the module-level singleton in `connectors/cron/module.ts`.
 */
export class CronHandleService extends Service {
  private handles: CronHandleManager | null = null;

  constructor(ctx: Context) {
    super(ctx, "cronHandleManager");
  }

  set(handles: CronHandleManager | null): void {
    this.handles = handles;
  }

  get(): CronHandleManager | null {
    return this.handles;
  }

  reset(): void {
    this.handles = null;
  }
}

let current: CronHandleService | null = null;
let ownedCtx: Context | null = null;

/** 模块内单例（不再查进程根 context）。 */
export function ensureCronHandleService(): CronHandleService {
  if (!current) {
    ownedCtx ??= new Context();
    current = new CronHandleService(ownedCtx);
  }
  return current;
}

export function currentCronHandleService(): CronHandleService | null {
  return current;
}

/** Test teardown。 */
export function resetCronHandleServiceForTest(): void {
  current = null;
  ownedCtx = null;
}
