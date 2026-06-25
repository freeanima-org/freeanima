import type { PgRepositories, ConversationStorePort } from "@freeanima/core/repos";
import { parseCompressionState, isCompressed } from "@freeanima/core/compress";
import type { StoredMessage, ConversationMetaMessage } from "./stored-message.ts";

function store(repos: PgRepositories): ConversationStorePort {
  return repos.conversation;
}

export function postgresAvailable(repos: PgRepositories): boolean {
  return repos.pgAvailable;
}

export const usePostgresRead = postgresAvailable;

export async function pgWriteMeta(
  repos: PgRepositories,
  conversationId: string,
  meta: ConversationMetaMessage,
): Promise<void> {
  if (!postgresAvailable(repos)) return;
  await store(repos).upsertConversationMeta(conversationId, meta);
}

export async function pgWritePatchMeta(
  repos: PgRepositories,
  conversationId: string,
  patch: Partial<ConversationMetaMessage> & Record<string, unknown>,
): Promise<void> {
  if (!postgresAvailable(repos)) return;
  await store(repos).patchConversationMeta(conversationId, patch);
}

export async function pgWriteMessage(
  repos: PgRepositories,
  conversationId: string,
  msg: StoredMessage,
): Promise<void> {
  if (!postgresAvailable(repos)) return;
  await store(repos).appendMessage(conversationId, msg);
}

export async function pgWriteTruncate(
  repos: PgRepositories,
  conversationId: string,
  keepThroughPos: number,
): Promise<void> {
  if (!postgresAvailable(repos)) return;
  await store(repos).truncateMessagesAfter(conversationId, keepThroughPos);
}

export async function pgShiftMessagePositions(
  repos: PgRepositories,
  conversationId: string,
  afterPos: number,
  delta: number,
): Promise<void> {
  if (!postgresAvailable(repos)) return;
  await store(repos).shiftMessagePositions(conversationId, afterPos, delta);
}

export async function pgWriteDeleteConversation(
  repos: PgRepositories,
  conversationId: string,
): Promise<void> {
  if (!postgresAvailable(repos)) return;
  await store(repos).deleteConversation(conversationId);
}

export async function pgArchiveConversation(
  repos: PgRepositories,
  conversationId: string,
): Promise<void> {
  if (!postgresAvailable(repos)) return;
  await store(repos).archiveConversation(conversationId);
}

export async function pgUnarchiveConversation(
  repos: PgRepositories,
  conversationId: string,
): Promise<void> {
  if (!postgresAvailable(repos)) return;
  await store(repos).unarchiveConversation(conversationId);
}

export async function conversationExistsWithRouting(
  repos: PgRepositories,
  conversationId: string,
): Promise<boolean> {
  if (!postgresAvailable(repos)) return false;
  return store(repos).conversationExists(conversationId);
}

export async function loadMetaWithRouting(
  repos: PgRepositories,
  conversationId: string,
): Promise<ConversationMetaMessage | Record<string, never>> {
  if (!postgresAvailable(repos)) {
    return {};
  }
  return (await store(repos).getConversationMetaLite(conversationId)) ?? {};
}

export async function loadMessagesWithRouting(
  repos: PgRepositories,
  conversationId: string,
): Promise<StoredMessage[]> {
  if (!postgresAvailable(repos)) {
    return [];
  }
  return store(repos).listMessages(conversationId);
}

/** When compression boundary exists, runtime loads message window with pos > l2 only */
export async function loadMessagesForRuntimeWithRouting(
  repos: PgRepositories,
  conversationId: string,
  meta: ConversationMetaMessage | Record<string, never>,
): Promise<StoredMessage[]> {
  if (!postgresAvailable(repos)) {
    return [];
  }
  const compression = "compression" in meta ? meta.compression : undefined;
  const state = parseCompressionState(compression);
  if (state != null && isCompressed(state) && state.l2 > 0) {
    const fromPos = state.l2 + 1;
    return store(repos).listMessagesByPosRange(conversationId, fromPos);
  }
  return loadMessagesWithRouting(repos, conversationId);
}

export async function loadMessagesByPosRangeWithRouting(
  repos: PgRepositories,
  conversationId: string,
  fromPos: number,
  toPos?: number,
): Promise<StoredMessage[]> {
  if (!postgresAvailable(repos)) {
    return [];
  }
  return store(repos).listMessagesByPosRange(conversationId, fromPos, toPos);
}

export async function loadMessagesPageWithRouting(
  repos: PgRepositories,
  conversationId: string,
  offset: number,
  limit: number,
): Promise<StoredMessage[]> {
  if (!postgresAvailable(repos)) {
    return [];
  }
  return store(repos).listMessagesPage(conversationId, offset, limit);
}

export async function countMessagesWithRouting(
  repos: PgRepositories,
  conversationId: string,
): Promise<number> {
  if (!postgresAvailable(repos)) {
    return 0;
  }
  return store(repos).countMessages(conversationId);
}

export async function countUserMessagesWithRouting(
  repos: PgRepositories,
  conversationId: string,
): Promise<number> {
  if (!postgresAvailable(repos)) {
    return 0;
  }
  return store(repos).countUserMessages(conversationId);
}

export async function loadConversationToolsWithRouting(
  repos: PgRepositories,
  conversationId: string,
): Promise<ConversationMetaMessage["cached_toolsets"]> {
  if (!postgresAvailable(repos)) {
    return [];
  }
  return store(repos).getConversationTools(conversationId);
}

export async function listConversationsWithRouting(
  repos: PgRepositories,
  platform?: string | null,
  opts?: { includeArchived?: boolean },
): Promise<string[]> {
  if (!postgresAvailable(repos)) {
    return [];
  }
  return store(repos).listConversationIds(platform, opts);
}

export async function nextMessagePosWithRouting(
  repos: PgRepositories,
  conversationId: string,
): Promise<number> {
  if (!postgresAvailable(repos)) {
    throw new Error("database.url not configured");
  }
  return store(repos).nextMessagePos(conversationId);
}

export async function pgCountConversationsByPlatform(
  repos: PgRepositories,
): Promise<Record<string, number>> {
  return store(repos).countConversationsByPlatform();
}

export async function pgListConversationSummaries(
  repos: PgRepositories,
  platform?: string | null,
  opts?: { includeArchived?: boolean },
): Promise<
  Array<{ id: string; title: string; created: string; platform: string; archived_at?: string | null }>
> {
  return store(repos).listConversationSummaries(platform, opts);
}

export async function pgListConversationSummariesPage(
  repos: PgRepositories,
  opts?: { platform?: string | null; offset?: number; limit?: number; includeArchived?: boolean },
): Promise<{
  items: Array<{
    id: string;
    title: string;
    created: string;
    platform: string;
    archived_at?: string | null;
  }>;
  total: number;
}> {
  return store(repos).listConversationSummariesPage(opts);
}

export async function pgDeleteDebugConversations(repos: PgRepositories): Promise<number> {
  return store(repos).deleteDebugConversations();
}

export async function pgListDebugConversationIds(repos: PgRepositories): Promise<string[]> {
  return store(repos).listDebugConversationIds();
}

export async function pgLastMessageTimestamp(
  repos: PgRepositories,
  conversationId: string,
): Promise<string | null> {
  return store(repos).lastMessageTimestamp(conversationId);
}

export async function pgListConversationIdsMatchingPlatformProbe(
  repos: PgRepositories,
  platform: string,
  platformExtra: Record<string, unknown> = {},
): Promise<string[]> {
  return store(repos).listConversationIdsMatchingPlatformProbe(platform, platformExtra);
}

export async function pgFindConversationIdByPlatformInfo(
  repos: PgRepositories,
  platform: string,
  platformExtra: Record<string, unknown> = {},
): Promise<string | null> {
  return store(repos).findConversationIdByPlatformInfo(platform, platformExtra);
}

export async function pgGetConversationMeta(
  repos: PgRepositories,
  conversationId: string,
): Promise<ConversationMetaMessage | null> {
  return store(repos).getConversationMeta(conversationId);
}

export async function pgGetConversationMetaLite(
  repos: PgRepositories,
  conversationId: string,
): Promise<ConversationMetaMessage | null> {
  return store(repos).getConversationMetaLite(conversationId);
}

export async function pgListMessages(
  repos: PgRepositories,
  conversationId: string,
): Promise<StoredMessage[]> {
  return store(repos).listMessages(conversationId);
}
