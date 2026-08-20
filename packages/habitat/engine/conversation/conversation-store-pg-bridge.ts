import {
  archiveConversation,
  countConversationsByPlatform,
  countMessages,
  countUserMessages,
  conversationExists,
  deleteConversation,
  deleteDebugConversations,
  deleteStaleConversations,
  findConversationIdByPlatformInfo,
  getConversationMeta,
  getConversationMetaLite,
  getConversationTools,
  listConversationIds,
  listConversationIdsMatchingPlatformProbe,
  listConversationSummaries,
  listConversationSummariesPage,
  listDebugConversationIds,
  listMessages,
  listMessagesByPosRange,
  listMessagesPage,
  listMessagesBeforePos,
  nextMessagePos,
  getMaxMessagePos,
  findUserMessageByClientOpId,
  getLastMessageRole,
  patchConversationMeta,
  appendMessage,
  shiftMessagePositions,
  truncateMessagesAfter,
  unarchiveConversation,
  pinConversation,
  unpinConversation,
  upsertConversationMeta,
  lastMessageTimestamp,
} from "@freeanima/habitat/core/db/pg/conversation";
import { parseCompressionState, isCompressed } from "@freeanima/habitat/core/compress";
import type { StoredMessage, ConversationMetaMessage } from "@freeanima/habitat/core/db/domain";

export async function pgWriteMeta(
  conversationId: string,
  meta: ConversationMetaMessage,
): Promise<void> {
  await upsertConversationMeta(conversationId, meta);
}

export async function pgWritePatchMeta(
  conversationId: string,
  patch: Partial<ConversationMetaMessage> & Record<string, unknown>,
): Promise<void> {
  await patchConversationMeta(conversationId, patch);
}

export async function pgWriteMessage(conversationId: string, msg: StoredMessage): Promise<void> {
  await appendMessage(conversationId, msg);
}

export async function pgWriteTruncate(
  conversationId: string,
  keepThroughPos: number,
): Promise<void> {
  await truncateMessagesAfter(conversationId, keepThroughPos);
}

export async function pgShiftMessagePositions(
  conversationId: string,
  afterPos: number,
  delta: number,
): Promise<void> {
  await shiftMessagePositions(conversationId, afterPos, delta);
}

export async function pgWriteDeleteConversation(conversationId: string): Promise<void> {
  await deleteConversation(conversationId);
}

export async function pgArchiveConversation(conversationId: string): Promise<void> {
  await archiveConversation(conversationId);
}

export async function pgUnarchiveConversation(conversationId: string): Promise<void> {
  await unarchiveConversation(conversationId);
}

export async function pgPinConversation(conversationId: string): Promise<void> {
  await pinConversation(conversationId);
}

export async function pgUnpinConversation(conversationId: string): Promise<void> {
  await unpinConversation(conversationId);
}

export async function conversationExistsWithRouting(conversationId: string): Promise<boolean> {
  return conversationExists(conversationId);
}

export async function loadMetaWithRouting(
  conversationId: string,
): Promise<ConversationMetaMessage | Record<string, never>> {
  return (await getConversationMetaLite(conversationId)) ?? {};
}

export async function loadMessagesWithRouting(conversationId: string): Promise<StoredMessage[]> {
  return listMessages(conversationId);
}

/** When compression boundary exists, runtime loads message window with pos > l2 only */
export async function loadMessagesForRuntimeWithRouting(
  conversationId: string,
  meta: ConversationMetaMessage | Record<string, never>,
): Promise<StoredMessage[]> {
  const compression = "compression" in meta ? meta.compression : undefined;
  const state = parseCompressionState(compression);
  if (state != null && isCompressed(state) && state.l2 > 0) {
    return listMessagesByPosRange(conversationId, state.l2 + 1);
  }
  return loadMessagesWithRouting(conversationId);
}

export async function loadMessagesByPosRangeWithRouting(
  conversationId: string,
  fromPos: number,
  toPos?: number,
): Promise<StoredMessage[]> {
  return listMessagesByPosRange(conversationId, fromPos, toPos);
}

export async function loadMessagesPageWithRouting(
  conversationId: string,
  offset: number,
  limit: number,
): Promise<StoredMessage[]> {
  return listMessagesPage(conversationId, offset, limit);
}

export async function loadMessagesBeforePosWithRouting(
  conversationId: string,
  beforePos: number,
  limit: number,
): Promise<StoredMessage[]> {
  return listMessagesBeforePos(conversationId, beforePos, limit);
}

export async function countMessagesWithRouting(conversationId: string): Promise<number> {
  return countMessages(conversationId);
}

export async function countUserMessagesWithRouting(conversationId: string): Promise<number> {
  return countUserMessages(conversationId);
}

export async function loadConversationToolsWithRouting(
  conversationId: string,
): Promise<ConversationMetaMessage["cached_toolsets"]> {
  return getConversationTools(conversationId);
}

export async function listConversationsWithRouting(
  platform?: string | null,
  opts?: { includeArchived?: boolean },
): Promise<string[]> {
  return listConversationIds(platform, opts);
}

export async function nextMessagePosWithRouting(conversationId: string): Promise<number> {
  return nextMessagePos(conversationId);
}

export async function getMaxMessagePosWithRouting(conversationId: string): Promise<number> {
  return getMaxMessagePos(conversationId);
}

export async function findUserMessageByClientOpIdWithRouting(
  conversationId: string,
  client_op_id: string,
) {
  return findUserMessageByClientOpId(conversationId, client_op_id);
}

export async function getLastMessageRoleWithRouting(
  conversationId: string,
): Promise<string | null> {
  return getLastMessageRole(conversationId);
}

export async function pgCountConversationsByPlatform(): Promise<Record<string, number>> {
  return countConversationsByPlatform();
}

export async function pgListConversationSummaries(
  platform?: string | null,
  opts?: { includeArchived?: boolean },
): Promise<
  Array<{
    id: string;
    title: string;
    created_at: Date;
    updated_at: Date;
    platform: string;
    archived_at?: Date | null;
    pinned_at?: Date | null;
  }>
> {
  return listConversationSummaries(platform, opts);
}

export async function pgListConversationSummariesPage(opts?: {
  platform?: string | null;
  offset?: number;
  limit?: number;
  includeArchived?: boolean;
  user_subject_id?: number;
}): Promise<{
  items: Array<{
    id: string;
    title: string;
    created_at: Date;
    updated_at: Date;
    platform: string;
    archived_at?: Date | null;
    pinned_at?: Date | null;
    unread?: boolean;
  }>;
  total: number;
}> {
  return listConversationSummariesPage(opts);
}

export async function pgDeleteDebugConversations(): Promise<number> {
  return deleteDebugConversations();
}

export async function pgListDebugConversationIds(): Promise<string[]> {
  return listDebugConversationIds();
}

export async function pgLastMessageTimestamp(conversationId: string): Promise<string | null> {
  return lastMessageTimestamp(conversationId);
}

export async function pgListConversationIdsMatchingPlatformProbe(
  platform: string,
  platformExtra: Record<string, unknown> = {},
): Promise<string[]> {
  return listConversationIdsMatchingPlatformProbe(platform, platformExtra);
}

export async function pgFindConversationIdByPlatformInfo(
  platform: string,
  platformExtra: Record<string, unknown> = {},
): Promise<string | null> {
  return findConversationIdByPlatformInfo(platform, platformExtra);
}

export async function pgGetConversationMeta(
  conversationId: string,
): Promise<ConversationMetaMessage | null> {
  return getConversationMeta(conversationId);
}

export async function pgGetConversationMetaLite(
  conversationId: string,
): Promise<ConversationMetaMessage | null> {
  return getConversationMetaLite(conversationId);
}

export async function pgListMessages(conversationId: string): Promise<StoredMessage[]> {
  return listMessages(conversationId);
}

export { deleteStaleConversations };
