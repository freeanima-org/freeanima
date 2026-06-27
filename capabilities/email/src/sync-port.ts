import type { EmailSyncResult } from "./types.ts";

export type EmailSyncPort = {
  syncAccount: (accountId: number, opts?: { limit?: number }) => Promise<EmailSyncResult>;
  syncAll: (opts?: { limit?: number }) => Promise<EmailSyncResult[]>;
};

let emailSyncPort: EmailSyncPort | null = null;

export function registerEmailSyncPort(port: EmailSyncPort): void {
  emailSyncPort = port;
}

export function getEmailSyncPort(): EmailSyncPort {
  if (!emailSyncPort) throw new Error("email sync port not registered");
  return emailSyncPort;
}

export function resetEmailSyncPortForTests(): void {
  emailSyncPort = null;
}
