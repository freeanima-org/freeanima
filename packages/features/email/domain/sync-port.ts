import { ensureRootContext, getRootContextOrNull } from "@freeanima/kernel";

import { mountEmailSyncPortService } from "./sync-port-service.ts";
import type { EmailSyncResult } from "./types.ts";

export type EmailSyncPort = {
  syncAccount: (accountId: number, opts?: { limit?: number }) => Promise<EmailSyncResult>;
  syncAll: (opts?: { worldId?: number; limit?: number }) => Promise<EmailSyncResult[]>;
};

export function registerEmailSyncPort(port: EmailSyncPort): void {
  mountEmailSyncPortService(ensureRootContext()).register(port);
}

export function getEmailSyncPort(): EmailSyncPort {
  const service = getRootContextOrNull()?.emailSyncPort;
  if (!service) throw new Error("email sync port not registered");
  return service.get();
}

export function resetEmailSyncPortForTests(): void {
  getRootContextOrNull()?.emailSyncPort?.reset();
}
