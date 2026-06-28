import type { PgRepositories, ConversationStorePort } from "@freeanima/core/repos";
import { parseCompressionState, isCompressed } from "@freeanima/core/compress";
import type { StoredMessage, ConversationMetaMessage } from "@freeanima/core/db/domain";

function store(repos: PgRepositories): ConversationStorePort {
  return repos.conversation;
}

export function postgresAvailable(repos: PgRepositories): boolean {
  return repos.pgAvailable;
}

async function whenPg<T>(
  repos: PgRepositories,
  fallback: T,
  fn: (conversation: ConversationStorePort) => Promise<T>,
): Promise<T> {
  if (!postgresAvailable(repos)) return fallback;
  return fn(store(repos));
}

async function whenPgVoid(
  repos: PgRepositories,
  fn: (conversation: ConversationStorePort) => Promise<unknown>,
): Promise<void> {
  if (!postgresAvailable(repos)) return;
  await fn(store(repos));
}

export async function pgWriteMeta(
  repos: PgRepositories,
  conversationId: string,
  meta: ConversationMetaMessage,
): Promise<void> {
  await whenPgVoid(repos, (s) => s.upsertConversationMeta(conversationId, meta));
}

export async function pgWritePatchMeta(
  repos: PgRepositories,
  conversationId: string,
  patch: Partial<ConversationMetaMessage> & Record<string, unknown>,
): Promise<void> {
  await whenPgVoid(repos, (s) => s.patchConversationMeta(conversationId, patch));
}

export async function pgWriteMessage(
  repos: PgRepositories,
  conversationId: string,
  msg: StoredMessage,
): Promise<void> {
  await whenPgVoid(repos, (s) => s.appendMessage(conversationId, msg));
}

export async function pgWriteTruncate(
  repos: PgRepositories,
  conversationId: string,
  keepThroughPos: number,
): Promise<void> {
  await whenPgVoid(repos, (s) => s.truncateMessagesAfter(conversationId, keepThroughPos));
}

export async function pgShiftMessagePositions(
  repos: PgRepositories,
  conversationId: string,
  afterPos: number,
  delta: number,
): Promise<void> {
  await whenPgVoid(repos, (s) => s.shiftMessagePositions(conversationId, afterPos, delta));
}

export async function pgWriteDeleteConversation(
  repos: PgRepositories,
  conversationId: string,
): Promise<void> {
  await whenPgVoid(repos, (s) => s.deleteConversation(conversationId));
}

export async function pgArchiveConversation(
  repos: PgRepositories,
  conversationId: string,
): Promise<void> {
  await whenPgVoid(repos, (s) => s.archiveConversation(conversationId));
}

export async function pgUnarchiveConversation(
  repos: PgRepositories,
  conversationId: string,
): Promise<void> {
  await whenPgVoid(repos, (s) => s.unarchiveConversation(conversationId));
}

export async function conversationExistsWithRouting(
  repos: PgRepositories,
  conversationId: string,
): Promise<boolean> {
  return whenPg(repos, false, (s) => s.conversationExists(conversationId));
}

export async function loadMetaWithRouting(
  repos: PgRepositories,
  conversationId: string,
): Promise<ConversationMetaMessage | Record<string, never>> {
  return whenPg(repos, {}, async (s) => (await s.getConversationMetaLite(conversationId)) ?? {});
}

export async function loadMessagesWithRouting(
  repos: PgRepositories,
  conversationId: string,
): Promise<StoredMessage[]> {
  return whenPg(repos, [], (s) => s.listMessages(conversationId));
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
  return whenPg(repos, [], (s) => s.listMessagesByPosRange(conversationId, fromPos, toPos));
}

export async function loadMessagesPageWithRouting(
  repos: PgRepositories,
  conversationId: string,
  offset: number,
  limit: number,
): Promise<StoredMessage[]> {
  return whenPg(repos, [], (s) => s.listMessagesPage(conversationId, offset, limit));
}

export async function countMessagesWithRouting(
  repos: PgRepositories,
  conversationId: string,
): Promise<number> {
  return whenPg(repos, 0, (s) => s.countMessages(conversationId));
}

export async function countUserMessagesWithRouting(
  repos: PgRepositories,
  conversationId: string,
): Promise<number> {
  return whenPg(repos, 0, (s) => s.countUserMessages(conversationId));
}

export async function loadConversationToolsWithRouting(
  repos: PgRepositories,
  conversationId: string,
): Promise<ConversationMetaMessage["cached_toolsets"]> {
  return whenPg(repos, [], (s) => s.getConversationTools(conversationId));
}

export async function listConversationsWithRouting(
  repos: PgRepositories,
  platform?: string | null,
  opts?: { includeArchived?: boolean },
): Promise<string[]> {
  return whenPg(repos, [], (s) => s.listConversationIds(platform, opts));
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
  Array<{
    id: string;
    title: string;
    created: string;
    platform: string;
    archived_at?: string | null;
  }>
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
