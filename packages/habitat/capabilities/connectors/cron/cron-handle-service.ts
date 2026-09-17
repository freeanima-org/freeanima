import { Service, type Context } from "cordis";
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

/** Mount synchronously (idempotent: re-mounting reuses the existing instance). */
export function mountCronHandleService(ctx: Context): CronHandleService {
  const existing = ctx.cronHandleManager as CronHandleService | undefined;
  if (existing) return existing;
  return new CronHandleService(ctx);
}
