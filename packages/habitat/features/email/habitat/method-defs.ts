import {
  emailAccountCreateInputSchema,
  emailAccountCreateOutputSchema,
  emailAccountDeleteInputSchema,
  emailAccountDeleteOutputSchema,
  emailAccountListInputSchema,
  emailAccountListOutputSchema,
  emailAccountPatchInputSchema,
  emailAccountPatchOutputSchema,
  emailDraftSaveInputSchema,
  emailDraftSaveOutputSchema,
  emailDraftSendInputSchema,
  emailDraftSendOutputSchema,
  emailMailboxCreateInputSchema,
  emailMailboxCreateOutputSchema,
  emailMailboxDeleteInputSchema,
  emailMailboxDeleteOutputSchema,
  emailMailboxListInputSchema,
  emailMailboxListOutputSchema,
  emailMailboxRenameInputSchema,
  emailMailboxRenameOutputSchema,
  emailMessageDeleteInputSchema,
  emailMessageDeleteOutputSchema,
  emailMessageListInputSchema,
  emailMessageListOutputSchema,
  emailMessageMarkFlaggedInputSchema,
  emailMessageMarkFlaggedOutputSchema,
  emailMessageMarkReadInputSchema,
  emailMessageMarkReadOutputSchema,
  emailMessageMarkUnflaggedInputSchema,
  emailMessageMarkUnflaggedOutputSchema,
  emailMessageMarkUnreadInputSchema,
  emailMessageMarkUnreadOutputSchema,
  emailMessageMoveInputSchema,
  emailMessageMoveOutputSchema,
  emailMessageReadInputSchema,
  emailMessageReadOutputSchema,
  emailMessageAttachTaskInputSchema,
  emailMessageAttachTaskOutputSchema,
  emailMessageDetachTaskInputSchema,
  emailMessageDetachTaskOutputSchema,
  emailMessageSearchInputSchema,
  emailMessageSearchOutputSchema,
  emailProviderListInputSchema,
  emailProviderListOutputSchema,
  emailSendInputSchema,
  emailSendOutputSchema,
  emailAttachmentUploadInputSchema,
  emailAttachmentUploadOutputSchema,
  emailSyncInputSchema,
  emailSyncOutputSchema,
  emailThreadListInputSchema,
  emailThreadListOutputSchema,
} from "@freeanima/shared/rpc-contract/frames/email";

import {
  binaryHttpMeta,
  defineHabitatMethod,
  dualTransportMeta,
  type HabitatMethodMeta,
} from "@freeanima/shared/habitat-contract";
import {
  HABITAT_RPC_BINARY_TRANSFER_TIMEOUT_MS,
  HABITAT_RPC_EMAIL_IMAP_TIMEOUT_MS,
  HABITAT_RPC_EMAIL_SYNC_TIMEOUT_MS,
} from "@freeanima/shared/habitat-rpc";

function writeMeta(timeoutMs: number): HabitatMethodMeta {
  return { ...dualTransportMeta(false), timeoutMs };
}

export const emailMethodDefs = {
  "emailaccount.list": defineHabitatMethod({
    input: emailAccountListInputSchema,
    output: emailAccountListOutputSchema,
    meta: dualTransportMeta(true),
  }),
  "emailaccount.create": defineHabitatMethod({
    input: emailAccountCreateInputSchema,
    output: emailAccountCreateOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "emailaccount.patch": defineHabitatMethod({
    input: emailAccountPatchInputSchema,
    output: emailAccountPatchOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "emailaccount.delete": defineHabitatMethod({
    input: emailAccountDeleteInputSchema,
    output: emailAccountDeleteOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "emailprovider.list": defineHabitatMethod({
    input: emailProviderListInputSchema,
    output: emailProviderListOutputSchema,
    meta: dualTransportMeta(true),
  }),
  "email.message.list": defineHabitatMethod({
    input: emailMessageListInputSchema,
    output: emailMessageListOutputSchema,
    meta: dualTransportMeta(true),
  }),
  "email.message.read": defineHabitatMethod({
    input: emailMessageReadInputSchema,
    output: emailMessageReadOutputSchema,
    meta: dualTransportMeta(true),
  }),
  "email.message.attachTask": defineHabitatMethod({
    input: emailMessageAttachTaskInputSchema,
    output: emailMessageAttachTaskOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "email.message.detachTask": defineHabitatMethod({
    input: emailMessageDetachTaskInputSchema,
    output: emailMessageDetachTaskOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "email.message.markRead": defineHabitatMethod({
    input: emailMessageMarkReadInputSchema,
    output: emailMessageMarkReadOutputSchema,
    meta: writeMeta(HABITAT_RPC_EMAIL_IMAP_TIMEOUT_MS),
  }),
  "email.message.markUnread": defineHabitatMethod({
    input: emailMessageMarkUnreadInputSchema,
    output: emailMessageMarkUnreadOutputSchema,
    meta: writeMeta(HABITAT_RPC_EMAIL_IMAP_TIMEOUT_MS),
  }),
  "email.message.delete": defineHabitatMethod({
    input: emailMessageDeleteInputSchema,
    output: emailMessageDeleteOutputSchema,
    meta: writeMeta(HABITAT_RPC_EMAIL_IMAP_TIMEOUT_MS),
  }),
  "email.message.move": defineHabitatMethod({
    input: emailMessageMoveInputSchema,
    output: emailMessageMoveOutputSchema,
    meta: writeMeta(HABITAT_RPC_EMAIL_IMAP_TIMEOUT_MS),
  }),
  "email.message.markFlagged": defineHabitatMethod({
    input: emailMessageMarkFlaggedInputSchema,
    output: emailMessageMarkFlaggedOutputSchema,
    meta: writeMeta(HABITAT_RPC_EMAIL_IMAP_TIMEOUT_MS),
  }),
  "email.message.markUnflagged": defineHabitatMethod({
    input: emailMessageMarkUnflaggedInputSchema,
    output: emailMessageMarkUnflaggedOutputSchema,
    meta: writeMeta(HABITAT_RPC_EMAIL_IMAP_TIMEOUT_MS),
  }),
  "email.message.search": defineHabitatMethod({
    input: emailMessageSearchInputSchema,
    output: emailMessageSearchOutputSchema,
    meta: dualTransportMeta(true),
  }),
  "email.send": defineHabitatMethod({
    input: emailSendInputSchema,
    output: emailSendOutputSchema,
    meta: writeMeta(HABITAT_RPC_EMAIL_IMAP_TIMEOUT_MS),
  }),
  "email.attachment.upload": defineHabitatMethod({
    input: emailAttachmentUploadInputSchema,
    output: emailAttachmentUploadOutputSchema,
    meta: binaryHttpMeta({
      verb: "POST",
      path: "email/attachment/upload",
      request: "multipart",
      timeoutMs: HABITAT_RPC_BINARY_TRANSFER_TIMEOUT_MS,
    }),
  }),
  "email.sync": defineHabitatMethod({
    input: emailSyncInputSchema,
    output: emailSyncOutputSchema,
    meta: writeMeta(HABITAT_RPC_EMAIL_SYNC_TIMEOUT_MS),
  }),
  "email.mailbox.list": defineHabitatMethod({
    input: emailMailboxListInputSchema,
    output: emailMailboxListOutputSchema,
    meta: writeMeta(HABITAT_RPC_EMAIL_IMAP_TIMEOUT_MS),
  }),
  "email.mailbox.create": defineHabitatMethod({
    input: emailMailboxCreateInputSchema,
    output: emailMailboxCreateOutputSchema,
    meta: writeMeta(HABITAT_RPC_EMAIL_IMAP_TIMEOUT_MS),
  }),
  "email.mailbox.rename": defineHabitatMethod({
    input: emailMailboxRenameInputSchema,
    output: emailMailboxRenameOutputSchema,
    meta: writeMeta(HABITAT_RPC_EMAIL_IMAP_TIMEOUT_MS),
  }),
  "email.mailbox.delete": defineHabitatMethod({
    input: emailMailboxDeleteInputSchema,
    output: emailMailboxDeleteOutputSchema,
    meta: writeMeta(HABITAT_RPC_EMAIL_IMAP_TIMEOUT_MS),
  }),
  "email.draft.save": defineHabitatMethod({
    input: emailDraftSaveInputSchema,
    output: emailDraftSaveOutputSchema,
    meta: writeMeta(HABITAT_RPC_EMAIL_IMAP_TIMEOUT_MS),
  }),
  "email.draft.send": defineHabitatMethod({
    input: emailDraftSendInputSchema,
    output: emailDraftSendOutputSchema,
    meta: writeMeta(HABITAT_RPC_EMAIL_IMAP_TIMEOUT_MS),
  }),
  "emailthread.list": defineHabitatMethod({
    input: emailThreadListInputSchema,
    output: emailThreadListOutputSchema,
    meta: dualTransportMeta(true),
  }),
} as const;
