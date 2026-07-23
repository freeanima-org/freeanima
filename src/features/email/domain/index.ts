export type * from "./types.ts";
export { worldIdForAccount, worldIdForThread } from "./email-world.ts";
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
} from "./account-store.ts";
export {
  listEmailThreads,
  tagEmailThread,
  upsertEmailThread,
  deriveThreadKey,
  normalizeEmailSubject,
  findEmailThreadByKey,
  refreshThreadAggregates,
} from "./thread-store.ts";
export {
  deleteEmailMessageRow,
  findEmailMessageByImapUid,
  getEmailMessageRow,
  listEmailMessages,
  markEmailMessageRead,
  searchEmailMessages,
  setEmailMessageAttachments,
  tagEmailMessage,
  upsertEmailMessage,
} from "./message-store.ts";
export { persistEmailAttachments, removeEmailAccountAttachments } from "./attachment-store.ts";
export {
  registerEmailSyncPort,
  getEmailSyncPort,
  resetEmailSyncPortForTests,
  type EmailSyncPort,
} from "./sync-port.ts";
export { registerEmailTools } from "./tools.ts";
export {
  applyProviderPreset,
  assertCompleteEmailHosts,
  requireCompleteEmailHosts,
  EMAIL_PROVIDER_IDS,
  EMAIL_PROVIDER_PRESETS,
  isNamedEmailProvider,
  listEmailProviderPresets,
  type EmailHostFields,
  type EmailProviderId,
  type EmailProviderPreset,
} from "./provider-presets.ts";
