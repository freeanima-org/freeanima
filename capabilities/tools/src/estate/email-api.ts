import type {
  EmailAccount,
  EmailAccountInput,
  EmailAccountPatch,
  EmailFilter,
  EmailMessage,
} from "./types.ts";

/** Email I/O surface injected from platform/connectors/email at composition root */
export type EmailApi = {
  registerEmailAccount: (input: EmailAccountInput) => Promise<EmailAccount>;
  editEmailAccount: (id: string, patch: EmailAccountPatch) => EmailAccount;
  listEmailAccounts: () => EmailAccount[];
  deleteEmailAccount: (id: string) => void;
  sendEmail: (input: {
    account_id?: string;
    to: string;
    subject: string;
    body: string;
    cc?: string;
    bcc?: string;
  }) => Promise<unknown>;
  fetchEmails: (accountId?: string, limit?: number) => Promise<EmailMessage[]>;
  listEmails: (accountId?: string, filter?: EmailFilter) => Promise<EmailMessage[]>;
  readEmail: (accountId: string, uid: number) => Promise<EmailMessage>;
  markAsRead: (accountId: string, uid: number) => Promise<unknown>;
  deleteEmail: (accountId: string, uid: number) => Promise<unknown>;
};
