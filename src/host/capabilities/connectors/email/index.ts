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
export {
  markAsRead,
  markAsUnread,
  markAsFlagged,
  markAsUnflagged,
  deleteEmail,
  moveMessage,
  saveDraft,
  sendDraft,
} from "./actions.ts";
export {
  syncEmailAccount,
  syncAllEmailAccounts,
  listMailboxesForAccount,
  emailSyncPortImpl,
  type ListedMailbox,
} from "./sync.ts";
export {
  buildNewMailNotificationContent,
  bucketNewMailSubjectsByWorld,
  collectNewMailSubjects,
  notifyNewMailFromSyncResults,
} from "./new-mail-notify.ts";
export { createMailbox, renameMailbox, deleteMailbox } from "./mailbox-ops.ts";
export { sendEmail, type SendEmailInput, type SaveDraftInput } from "./send.ts";
export { assertEmailPasswordResolvable, resolveEmailAccountPassword } from "./password.ts";
export {
  startEmailIdleForAccount,
  startEmailIdleForAllEnabledAccounts,
  stopAllEmailIdle,
  stopEmailIdleForAccount,
} from "./idle.ts";
export { listAllEnabledEmailAccountRows } from "@freeanima/features/email/domain";
