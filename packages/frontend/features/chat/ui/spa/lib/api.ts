import type { ConversationListItem, DisplayItem, StreamApiEvent } from "./types.ts";
import type { ConversationContextUsage, LlmUsageTotals } from "@freeanima/shared/llm-usage";
import { resolveHabitatCacheScope } from "@freeanima/client/portal-sdk/offline-cache";
import { withOfflineCache } from "@freeanima/client/portal-sdk/offline-cache-first";
import { isHabitatFetchAvailable } from "@freeanima/client/portal-sdk/habitat-fetch-gate";
import { getTypedHabitatClient } from "@freeanima/client/portal-sdk/habitat-typed-client.ts";
import { getChatRpcStreamClient, chatPlatform } from "./habitat-stream-client.ts";
import { omitUndefined } from "@freeanima/shared/util";
import { readCachedConversations } from "./offline-cache.ts";

type SubscribeCallbacks<T> = {
  onData?: (data: T) => void;
  onError?: (err: Error) => void;
  onComplete?: () => void;
  onStreamId?: (streamId: string) => void;
};

function mapConversationList(raw: {
  conversations: Array<{
    conversation_id: string;
    title?: string | undefined;
    platform?: string | undefined;
    updated_at?: string | undefined;
    archived_at?: string | null | undefined;
    pinned_at?: string | null | undefined;
    unread?: boolean | undefined;
  }>;
}): { conversations: ConversationListItem[] } {
  return {
    conversations: raw.conversations.map((s) => ({
      id: s.conversation_id,
      title: s.title ?? "",
      platform: s.platform ?? "",
      created: s.updated_at ?? "",
      archivedAt: s.archived_at ?? null,
      pinnedAt: s.pinned_at ?? null,
      ...(s.unread === true ? { unread: true } : {}),
    })),
  };
}

function habitat() {
  return getTypedHabitatClient();
}

function requireHabitatFetch(method: string): void {
  if (!isHabitatFetchAvailable()) {
    throw new Error(`${method} unavailable offline`);
  }
}

/** WS-only 流式仍走 RpcStreamClient */
function sap() {
  return getChatRpcStreamClient();
}

export type { StreamApiEvent } from "./types.ts";

export async function listConversations(opts?: { includeArchived?: boolean }) {
  const includeArchived = opts?.includeArchived === true;
  const scope = resolveHabitatCacheScope();
  try {
    const conversations = await withOfflineCache({
      scope,
      namespace: "conversations",
      id: `archived:${includeArchived}`,
      fetch: async () => {
        const result = await habitat().call("conversation.list", {
          platform: chatPlatform(),
          include_archived: opts?.includeArchived,
        });
        return mapConversationList(result).conversations;
      },
      offlineError: "conversation.list unavailable offline",
    });
    return { conversations };
  } catch {
    const cached = await readCachedConversations(scope, includeArchived);
    return { conversations: cached ?? [] };
  }
}

export async function createConversation() {
  const result = await habitat().call("conversation.create", { platform: chatPlatform() });
  return { conversation_id: result.conversation_id };
}

export type ConversationShareTtl = "1h" | "1d" | "1w" | "1mo";

export async function createConversationShare(input: {
  conversationId: string;
  ttl?: ConversationShareTtl;
  posList?: number[];
}): Promise<{ id: string; expires_at: string; url_path: string }> {
  requireHabitatFetch("conversation.share.create");
  return habitat().call(
    "conversation.share.create",
    omitUndefined({
      conversation_id: input.conversationId,
      ttl: input.ttl,
      pos_list: input.posList,
    }),
  );
}

export async function getConversationTail(conversationId: string) {
  requireHabitatFetch("conversation.tail");
  return habitat().call("conversation.tail", { conversation_id: conversationId });
}

/** 将用户已读水位升到当前（或指定）pos */
export async function markConversationRead(
  conversationId: string,
  lastReadPos?: number,
): Promise<{ ok: true; last_read_pos: number }> {
  requireHabitatFetch("conversation.markRead");
  return habitat().call(
    "conversation.markRead",
    omitUndefined({
      conversation_id: conversationId,
      last_read_pos: lastReadPos,
    }),
  );
}

/** 用户未归档未读会话数（Shell 角标；与列表同 platform） */
export async function getUnreadConversationCount(): Promise<number> {
  requireHabitatFetch("conversation.unreadCount");
  const result = await habitat().call("conversation.unreadCount", {
    platform: chatPlatform(),
  });
  return result.count;
}

export type StoredMessagesOpts = {
  limit?: number;
  before_pos?: number;
};

export type StoredMessagesResponse = {
  conversation_id?: string;
  display?: DisplayItem[];
  total?: number;
  offset?: number;
  limit?: number | null;
  from_pos?: number;
  to_pos?: number;
  has_more_before?: boolean;
  usage?: LlmUsageTotals;
  context?: ConversationContextUsage;
};

/** Chat 消息分页：不传 offset（服务端尾页）；向上加载传 before_pos */
export async function getStoredMessages(
  conversationId: string,
  opts?: StoredMessagesOpts,
): Promise<StoredMessagesResponse> {
  requireHabitatFetch("conversation.messages");
  return habitat().call(
    "conversation.messages",
    omitUndefined({
      conversation_id: conversationId,
      limit: opts?.limit,
      before_pos: opts?.before_pos,
    }),
  );
}

export async function setConversationTitle(conversationId: string, title: string) {
  await habitat().call("conversation.patchTitle", { conversation_id: conversationId, title });
  return { ok: true as const };
}

export async function archiveConversation(conversationId: string) {
  await habitat().call("conversation.archive", { conversation_id: conversationId });
  return { ok: true as const };
}

export async function unarchiveConversation(conversationId: string) {
  await habitat().call("conversation.unarchive", { conversation_id: conversationId });
  return { ok: true as const };
}

export async function pinConversation(conversationId: string) {
  await habitat().call("conversation.pin", { conversation_id: conversationId });
  return { ok: true as const };
}

export async function unpinConversation(conversationId: string) {
  await habitat().call("conversation.unpin", { conversation_id: conversationId });
  return { ok: true as const };
}

export async function deleteConversation(conversationId: string) {
  await habitat().call("conversation.delete", { conversation_id: conversationId });
  return { ok: true as const };
}

/** 重编辑：删除末条用户消息及其后的所有内容 */
export async function rollbackBeforeLastUserMessage(conversationId: string) {
  await habitat().call("conversation.rollbackBeforeLastUser", { conversation_id: conversationId });
  return { ok: true as const };
}

export async function listCommands(opts?: { all?: boolean; platform?: string }) {
  return habitat().call("conversation.commands", {
    all: opts?.all,
    platform: opts?.platform,
  });
}

export async function interruptConversation(conversationId: string) {
  const client = await sap().whenReady();
  await client.request("message.interrupt", { conversation_id: conversationId });
  return { ok: true as const };
}

export function sendMessageStream(
  conversationId: string,
  message: string,
  callbacks: SubscribeCallbacks<StreamApiEvent>,
): { unsubscribe: () => void } {
  return sap().sendMessageStream({ conversationId, message }, callbacks);
}

export function subscribeConversationUpdates(
  conversationId: string,
  onUpdate: () => void,
): { unsubscribe: () => void } {
  return sap().subscribeConversationEvents(conversationId, onUpdate);
}

/** 任意会话更新（列表刷新 / 角标）；与单会话 subscribe 共用 conversation.updated 事件 */
export function subscribeConversationInbox(onUpdate: (conversationId: string) => void): {
  unsubscribe: () => void;
} {
  return sap().subscribeInboxEvents(onUpdate);
}

export {
  fetchLlmDebug,
  runConversationCommand,
  type ConversationCommandResult,
} from "./conversation-command-api.ts";

import { listConversationCommands as listConversationCommandsBase } from "./conversation-command-api.ts";

/** Chat 默认 platform=chat；可显式传入 Coding 等 platform */
export async function listConversationCommands(opts?: { all?: boolean; platform?: string }) {
  return listConversationCommandsBase({
    platform: opts?.platform ?? chatPlatform(),
    ...(opts?.all !== undefined ? { all: opts.all } : {}),
  });
}

export function subscribeMessageStream(
  input: {
    conversationId: string;
    message: string;
    llmDebug?: boolean;
    clientOpId?: string;
    expectedTailPos?: number;
    forceTail?: boolean;
    attachmentTempIds?: string[];
    attachments?: Array<{ filename: string; mime_type: string; size: number }>;
  },
  callbacks: SubscribeCallbacks<StreamApiEvent>,
): { unsubscribe: () => void } {
  return sap().sendMessageStream(input, callbacks);
}

export function subscribeContinueStream(
  input: { conversationId: string; llmDebug?: boolean },
  callbacks: SubscribeCallbacks<StreamApiEvent>,
): { unsubscribe: () => void } {
  return sap().continueMessageStream(input, callbacks);
}

export function resumeMessageStream(
  streamId: string,
  callbacks: SubscribeCallbacks<StreamApiEvent>,
): { unsubscribe: () => void } {
  return sap().resumeMessageStream(streamId, callbacks);
}

/** 按会话查询服务端仍持有的流（刷新后 sessionStorage 丢失时的权威来源） */
export async function lookupActiveStream(
  conversationId: string,
): Promise<{ stream_id?: string; status?: string }> {
  requireHabitatFetch("stream.lookup");
  const raw = await habitat().call("stream.lookup", { conversation_id: conversationId });
  if (!raw || typeof raw !== "object") return {};
  return raw as { stream_id?: string; status?: string };
}

export async function interruptMessageStream(conversationId: string): Promise<void> {
  const client = await sap().whenReady();
  await client.request("message.interrupt", { conversation_id: conversationId });
}

export async function loadConfig() {
  const shell = window.portalShell;
  if (shell?.habitatWsUrl) {
    return { app_id: "chat", habitat_ws_url: shell.habitatWsUrl };
  }

  if (shell?.isNativeShell) {
    throw new Error("Habitat 未配置，请先在设置中填写 栖息地地址与 Token");
  }

  const res = await fetch("/config.json");
  if (!res.ok) {
    throw new Error("网络错误");
  }
  const ct = res.headers.get("content-type") ?? "";
  if (!ct.includes("application/json")) {
    throw new Error("网络错误");
  }
  return res.json() as Promise<{
    app_id: string;
    habitat_ws_url?: string;
    instance_id?: string;
    relay_ws_url?: string;
  }>;
}

export function conversationErrorMessage(err: unknown): string {
  if (err instanceof Error && err.message.trim()) return err.message;
  return "网络错误";
}
