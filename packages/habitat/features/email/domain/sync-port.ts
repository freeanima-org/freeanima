import {
  ensureProcessContext,
  getProcessContext,
} from "@freeanima/habitat/platform/service/process-context.ts";

import { mountEmailSyncPortService } from "./sync-port-service.ts";
import type { EmailSyncResult } from "./types.ts";

export type EmailSyncPort = {
  syncAccount: (accountId: number, opts?: { limit?: number }) => Promise<EmailSyncResult>;
  syncAll: (opts?: { worldId?: number; limit?: number }) => Promise<EmailSyncResult[]>;
};

export function registerEmailSyncPort(port: EmailSyncPort): void {
  mountEmailSyncPortService(ensureProcessContext()).register(port);
}

export function getEmailSyncPort(): EmailSyncPort {
  const service = getProcessContext()?.emailSyncPort;
  if (!service) throw new Error("email sync port not registered");
  return service.get();
}

export function resetEmailSyncPortForTests(): void {
  getProcessContext()?.emailSyncPort?.reset();
}
