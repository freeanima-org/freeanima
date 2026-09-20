import { Context, Service } from "cordis";
import type { EmailSyncPort } from "./sync-port.ts";

declare module "cordis" {
  interface Context {
    emailSyncPort: EmailSyncPortService;
  }
}

/**
 * Cordis service (`ctx.emailSyncPort`) holding the email sync port registered
 * by the composition root. Replaces the module-level singleton in
 * `email/domain/sync-port.ts`.
 */
export class EmailSyncPortService extends Service {
  private port: EmailSyncPort | null = null;

  constructor(ctx: Context) {
    super(ctx, "emailSyncPort");
  }

  register(port: EmailSyncPort): void {
    this.port = port;
  }

  get(): EmailSyncPort {
    if (!this.port) throw new Error("email sync port not registered");
    return this.port;
  }

  reset(): void {
    this.port = null;
  }
}

let current: EmailSyncPortService | null = null;
let ownedCtx: Context | null = null;

/** 模块内单例（不再查进程根 context）。 */
export function ensureEmailSyncPortService(): EmailSyncPortService {
  if (!current) {
    ownedCtx ??= new Context();
    current = new EmailSyncPortService(ownedCtx);
  }
  return current;
}

export function currentEmailSyncPortService(): EmailSyncPortService | null {
  return current;
}

/** Test teardown。 */
export function resetEmailSyncPortServiceForTest(): void {
  current = null;
  ownedCtx = null;
}
