import { Service, type Context } from "cordis";
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

/** Mount synchronously (idempotent: re-mounting reuses the existing instance). */
export function mountEmailSyncPortService(ctx: Context): EmailSyncPortService {
  const existing = ctx.emailSyncPort as EmailSyncPortService | undefined;
  if (existing) return existing;
  return new EmailSyncPortService(ctx);
}
