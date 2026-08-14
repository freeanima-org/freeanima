export type * from "./types.ts";
export { worldIdForAccount, worldIdForThread } from "./email-world.ts";
export { normalizeRfcMessageId } from "./message-id.ts";
export {
  createEmailAccount,
  deleteEmailAccountRow,
  findEmailAccountByAddressAndHost,
  getDefaultEmailAccountRow,
  getEmailAccountRow,
  listEmailAccountRows,
  listEnabledEmailAccountRows,
  listAllEnabledEmailAccountRows,
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
  findEmailMessageByRfcMessageId,
  getEmailMessageRow,
  listEmailMessageImapRefs,
  listEmailMessages,
  markEmailMessageRead,
  searchEmailMessages,
  setEmailMessageAttachments,
  tagEmailMessage,
  updateEmailMessageFlags,
  updateEmailMessageMailbox,
  upsertEmailMessage,
} from "./message-store.ts";
export {
  attachTaskToEmailMessage,
  detachTaskFromEmailMessage,
  emailMessageHasTask,
  type AttachTaskToEmailInput,
} from "./attach-task.ts";
export {
  persistEmailAttachments,
  softDeleteEmailAttachmentObjectFiles,
  loadOutboundAttachmentFiles,
  outboundAttachmentMeta,
  type LoadedOutboundAttachment,
} from "./attachment-store.ts";
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
export {
  collectFlagRefreshUids,
  defaultSyncMailboxPaths,
  getMailboxCursor,
  inferSpecialUseFromPath,
  isMessageFlagged,
  mailboxesToSync,
  normalizeAccountSync,
  resolveSpecialMailboxes,
  setMailboxCursor,
  specialUseFromImapFlags,
  type ListedMailbox,
  type NormalizedEmailAccountSync,
} from "./sync-state.ts";
