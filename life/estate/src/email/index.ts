export {
  bindEmailAccountsConfig,
  resetEmailAccountsConfigForTest,
  deleteEmailAccount,
  editEmailAccount,
  getDefaultSender,
  getEmailAccounts,
  listEmailAccounts,
  resolveAccountPassword,
  registerEmailAccount,
  resolveAccount,
  resolveEnabledAccounts,
} from "./accounts.ts";
export { markAsRead, deleteEmail } from "./actions.ts";
export { fetchEmails, listEmails, readEmail } from "./receive.ts";
export { sendEmail, type SendEmailInput } from "./send.ts";
export { registerEmailTools } from "./tools.ts";
export type {
  EmailAccount,
  EmailAccountInput,
  EmailAccountPatch,
  EmailAccountView,
  EmailFilter,
  EmailMessage,
} from "./types.ts";
export { emailAccountInputSchema, emailAccountPatchSchema, emailFilterSchema } from "./types.ts";
