import type { ConversationAcpDockSnapshot, ConversationListItem, StreamApiEvent } from "./types.ts";
import { isHubFetchAvailable } from "@freeanima/frontend/shell-sdk/hub-fetch-gate";
import { getSatelliteHubClient } from "@freeanima/shared/hub-client";
import { getChatSapClient, chatPlatform } from "./sap-client.ts";
import { m } from "./i18n.ts";

type SubscribeCallbacks<T> = {
  onData?: (data: T) => void;
  onError?: (err: Error) => void;
  onComplete?: () => void;
};

function mapConversationList(raw: {
  conversations: Array<{
    conversation_id: string;
    title?: string | undefined;
    platform?: string | undefined;
    updated_at?: string | undefined;
    archived_at?: string | null | undefined;
  }>;
}): { conversations: ConversationListItem[] } {
  return {
    conversations: raw.conversations.map((s) => ({
      id: s.conversation_id,
      title: s.title ?? "",
      platform: s.platform ?? "",
      created: s.updated_at ?? "",
      archivedAt: s.archived_at ?? null,
    })),
  };
}

function hub() {
  return getSatelliteHubClient();
}

function requireHubFetch(method: string): void {
  if (!isHubFetchAvailable()) {
    throw new Error(`${method} unavailable offline`);
  }
}

/** WS-only 流式仍走 SapClient */
function sap() {
  return getChatSapClient();
}

export type { ConversationAcpDockSnapshot, StreamApiEvent } from "./types.ts";

export async function listConversations(opts?: { includeArchived?: boolean }) {
  requireHubFetch("conversation.list");
  const result = await hub().call("conversation.list", {
    platform: chatPlatform(),
    include_archived: opts?.includeArchived,
  });
  return mapConversationList(result);
}

export async function createConversation() {
  const result = await hub().call("conversation.create", { platform: chatPlatform() });
  return { conversation_id: result.conversation_id };
}

export async function getConversationTail(conversationId: string) {
  requireHubFetch("conversation.tail");
  return hub().call("conversation.tail", { conversation_id: conversationId });
}

export async function getStoredMessages(conversationId: string, offset = 0, limit = 500) {
  requireHubFetch("conversation.messages");
  return hub().call("conversation.messages", {
    conversation_id: conversationId,
    offset,
    limit,
  });
}

export async function setConversationTitle(conversationId: string, title: string) {
  await hub().call("conversation.patchTitle", { conversation_id: conversationId, title });
  return { ok: true as const };
}

export async function archiveConversation(conversationId: string) {
  await hub().call("conversation.archive", { conversation_id: conversationId });
  return { ok: true as const };
}

export async function unarchiveConversation(conversationId: string) {
  await hub().call("conversation.unarchive", { conversation_id: conversationId });
  return { ok: true as const };
}

export async function deleteConversation(conversationId: string) {
  await hub().call("conversation.delete", { conversation_id: conversationId });
  return { ok: true as const };
}

/** 重编辑：删除末条用户消息及其后的所有内容 */
export async function rollbackBeforeLastUserMessage(conversationId: string) {
  await hub().call("conversation.rollbackBeforeLastUser", { conversation_id: conversationId });
  return { ok: true as const };
}

export async function getConversationAcpDock(
  conversationId: string,
): Promise<ConversationAcpDockSnapshot> {
  requireHubFetch("conversation.acpDock");
  const raw = await hub().call("conversation.acpDock", { conversation_id: conversationId });
  return {
    ...raw,
    tasks: raw.tasks.map((task) => ({
      acp_conversation_id: task.acp_conversation_id,
      task_id: task.task_id,
      agent_name: task.agent_name,
      status: task.status,
      ...(task.progress_message_id !== undefined
        ? { progress_message_id: task.progress_message_id }
        : {}),
    })),
  };
}

export async function listCommands(opts?: { all?: boolean; platform?: string }) {
  return hub().call("conversation.commands", {
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

export async function listConversationCommands(opts?: { all?: boolean }) {
  return hub().call("conversation.commands", {
    platform: chatPlatform(),
    all: opts?.all,
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
  },
  callbacks: SubscribeCallbacks<StreamApiEvent>,
): { unsubscribe: () => void } {
  return sap().sendMessageStream(input, callbacks);
}

export async function interruptMessageStream(conversationId: string): Promise<void> {
  const client = await sap().whenReady();
  await client.request("message.interrupt", { conversation_id: conversationId });
}

export async function loadConfig() {
  const shell = window.satelliteShell;
  if (shell?.hubWsUrl) {
    return { app_id: "chat", hub_ws_url: shell.hubWsUrl };
  }

  if (shell?.isNativeShell) {
    throw new Error("Hub 未配置，请先在设置中填写 Hub 地址与 Token");
  }

  const res = await fetch("/config.json");
  if (!res.ok) {
    throw new Error(m.console_common_network_error());
  }
  const ct = res.headers.get("content-type") ?? "";
  if (!ct.includes("application/json")) {
    throw new Error(m.console_common_network_error());
  }
  return res.json() as Promise<{
    app_id: string;
    hub_ws_url?: string;
    instance_id?: string;
    relay_ws_url?: string;
  }>;
}

export function conversationErrorMessage(err: unknown): string {
  if (err instanceof Error && err.message.trim()) return err.message;
  return m.console_common_network_error();
}
