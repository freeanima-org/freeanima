export {
  createEmailAccount,
  deleteEmailAccountRow,
  findEmailAccountByAddressAndHost,
  getDefaultEmailAccountRow,
  getEmailAccountRow,
  listEmailAccountRows,
  listEnabledEmailAccountRows,
  resolveEmailAccountRow,
  updateEmailAccount,
} from "@freeanima/features/email/domain";
export { markAsRead, deleteEmail } from "./actions.ts";
export { syncEmailAccount, syncAllEmailAccounts, emailSyncPortImpl } from "./sync.ts";
export { sendEmail, type SendEmailInput } from "./send.ts";
export { assertEmailPasswordResolvable, resolveEmailAccountPassword } from "./password.ts";
