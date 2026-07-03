import {
  readOfflineCache,
  setSatelliteOfflineCacheBackendForTests,
  writeOfflineCache,
} from "@freeanima/shell-sdk/offline-cache";

import type { ConversationListItem, DisplayItem } from "./types.ts";

export { resolveHubCacheScope, resolveCacheScope } from "@freeanima/shell-sdk/offline-cache";

/** 单测注入内存后端 */
export function setOfflineCacheBackendForTests(map: Map<string, unknown> | null): void {
  setSatelliteOfflineCacheBackendForTests(map);
}

export async function readCachedConversations(
  scope: string,
  includeArchived: boolean,
): Promise<ConversationListItem[] | null> {
  const raw = await readOfflineCache<ConversationListItem[]>(
    scope,
    "conversations",
    `archived:${includeArchived}`,
  );
  return Array.isArray(raw) ? raw : null;
}

export async function writeCachedConversations(
  scope: string,
  includeArchived: boolean,
  conversations: ConversationListItem[],
): Promise<void> {
  await writeOfflineCache(scope, "conversations", `archived:${includeArchived}`, conversations);
}

export async function readCachedMessages(
  scope: string,
  conversationId: string,
): Promise<DisplayItem[] | null> {
  const raw = await readOfflineCache<DisplayItem[]>(scope, "messages", conversationId);
  return Array.isArray(raw) ? raw : null;
}

export async function writeCachedMessages(
  scope: string,
  conversationId: string,
  display: DisplayItem[],
): Promise<void> {
  await writeOfflineCache(scope, "messages", conversationId, display);
}
