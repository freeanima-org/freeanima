import type {
  FridgeMagnetsResponse,
  ConversationAcpDockSnapshot,
  ConversationListItem,
  StreamApiEvent,
} from "./types.ts";
import { getSapDirectClient } from "./sap-client.ts";
import { m } from "./i18n.ts";

type SubscribeCallbacks<T> = {
  onData?: (data: T) => void;
  onError?: (err: Error) => void;
  onComplete?: () => void;
};

function mapConversationList(raw: {
  conversations: Array<{
    conversation_id: string;
    title?: string;
    platform?: string;
    updated_at?: string;
  }>;
}): { conversations: ConversationListItem[] } {
  return {
    conversations: raw.conversations.map((s) => ({
      id: s.conversation_id,
      title: s.title ?? "",
      platform: s.platform ?? "",
      created: s.updated_at ?? "",
    })),
  };
}

function sap() {
  return getSapDirectClient();
}

export type { ConversationAcpDockSnapshot, StreamApiEvent } from "./types.ts";

export async function listConversations() {
  const client = await sap().whenReady();
  const result = await client.request("conversation.list", {});
  return mapConversationList(result);
}

export async function createConversation() {
  const client = await sap().whenReady();
  const result = await client.request("conversation.create", {});
  return { conversation_id: result.conversation_id };
}

export async function getStoredMessages(conversationId: string, offset = 0, limit = 500) {
  const client = await sap().whenReady();
  return client.request("conversation.messages", {
    conversation_id: conversationId,
    offset,
    limit,
  });
}

export async function setConversationTitle(conversationId: string, title: string) {
  const client = await sap().whenReady();
  await client.request("conversation.patchTitle", { conversation_id: conversationId, title });
  return { ok: true as const };
}

export async function getConversationAcpDock(
  conversationId: string,
): Promise<ConversationAcpDockSnapshot> {
  const client = await sap().whenReady();
  return client.request("conversation.acpDock", { conversation_id: conversationId });
}

export async function listConversationCommands(opts?: { all?: boolean }) {
  const client = await sap().whenReady();
  return client.request("conversation.commands", {
    all: opts?.all,
  });
}

export async function getFridgeMagnets(): Promise<FridgeMagnetsResponse> {
  const client = await sap().whenReady();
  const result = await client.request("fridge.list", {});
  return {
    redis_configured: result.redis_configured,
    magnets: result.magnets.map((item) => ({ key: item.key, value: item.value })),
    inject_text: result.inject_text,
  };
}

export function subscribeMessageStream(
  input: { conversationId: string; message: string },
  callbacks: SubscribeCallbacks<StreamApiEvent>,
): { unsubscribe: () => void } {
  return sap().sendMessageStream(input, callbacks);
}

export async function interruptMessageStream(conversationId: string): Promise<void> {
  const client = await sap().whenReady();
  await client.request("message.interrupt", { conversation_id: conversationId });
}

export function subscribeConversationEvents(
  conversationId: string,
  onUpdate: () => void,
): { unsubscribe: () => void } {
  return sap().subscribeConversationEvents(conversationId, onUpdate);
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
    throw new Error(m.admin_common_network_error());
  }
  const ct = res.headers.get("content-type") ?? "";
  if (!ct.includes("application/json")) {
    throw new Error(m.admin_common_network_error());
  }
  return res.json() as Promise<{
    app_id: string;
    hub_ws_url?: string;
    instance_id?: string;
    relay_ws_url?: string;
  }>;
}
