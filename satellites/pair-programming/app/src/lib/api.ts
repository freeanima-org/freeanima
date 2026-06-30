import type { StreamApiEvent } from "./types.ts";
import { m } from "./i18n.ts";
import { createSapSidecarClient, type SapSidecarClient } from "@freeanima/sap-contract";
import { pairPlatform, STUDIO_PAIR_PLATFORM } from "@pair/lib/sap-client.ts";

type SubscribeCallbacks<T> = {
  onData?: (data: T) => void;
  onError?: (err: Error) => void;
  onComplete?: () => void;
};

let sidecarClient: SapSidecarClient | null = null;

function sap(): SapSidecarClient {
  if (!sidecarClient) {
    sidecarClient = createSapSidecarClient();
  }
  return sidecarClient;
}

async function apiJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init);
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error ?? `HTTP ${res.status}`);
  }
  return (await res.json()) as T;
}

function mapConversationList(raw: {
  conversations: Array<{
    conversation_id: string;
    title?: string | undefined;
    platform?: string | undefined;
    updated_at?: string | undefined;
    archived_at?: string | null | undefined;
  }>;
}) {
  return {
    conversations: raw.conversations.map((s) => ({
      id: s.conversation_id,
      title: s.title ?? "",
      platform: s.platform ?? STUDIO_PAIR_PLATFORM,
      created: s.updated_at ?? "",
    })),
  };
}

export async function getStudioConfig() {
  return apiJson<Record<string, unknown>>("/api/studio/config");
}

export async function getStudioTree() {
  return apiJson<Record<string, unknown>>("/api/studio/tree");
}

export async function getStudioFile(path: string) {
  return apiJson<Record<string, unknown>>(`/api/studio/file?path=${encodeURIComponent(path)}`);
}

export async function searchStudio(query: string) {
  return apiJson<Record<string, unknown>>("/api/studio/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
}

export async function listConversations(platform?: string) {
  const client = await sap().whenReady();
  const result = await client.request("conversation.list", {
    platform: platform ?? (await pairPlatform()),
  });
  return mapConversationList(result);
}

export async function createConversation(platform?: string) {
  const client = await sap().whenReady();
  const cfg = await getStudioConfig();
  const result = await client.request("conversation.create", {
    platform: platform ?? (await pairPlatform()),
    workspace_root: String(cfg.workspace ?? "") || undefined,
    workspace_gitignore: Boolean(cfg.gitignore),
    workspace_show_hidden: Boolean(cfg.showHidden),
  });
  return { conversation_id: result.conversation_id };
}

export async function getStoredMessages(conversationId: string, offset?: number, limit?: number) {
  const client = await sap().whenReady();
  return client.request("conversation.messages", {
    conversation_id: conversationId,
    offset: offset ?? 0,
    limit: limit ?? 500,
  });
}

export async function setConversationTitle(conversationId: string, title: string) {
  const client = await sap().whenReady();
  await client.request("conversation.patchTitle", { conversation_id: conversationId, title });
  return { ok: true as const };
}

export function subscribeMessageStream(
  input: { conversationId: string; message: string },
  callbacks: SubscribeCallbacks<StreamApiEvent>,
): { unsubscribe: () => void } {
  return sap().sendMessageStream(input, callbacks);
}

type TerminalStreamEvent = {
  type: string;
  conversationId?: string;
  data?: string;
  code?: number;
  message?: string;
};

function terminalWsUrl(): string {
  const proto = location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${location.host}/api/studio/terminal/ws`;
}

export function subscribeTerminalStream(callbacks: SubscribeCallbacks<TerminalStreamEvent>): {
  unsubscribe: () => void;
} {
  let ws: WebSocket | null = null;
  let closed = false;

  ws = new WebSocket(terminalWsUrl());
  ws.addEventListener("message", (ev) => {
    if (closed || typeof ev.data !== "string") return;
    try {
      callbacks.onData?.(JSON.parse(ev.data) as TerminalStreamEvent);
    } catch {
      /* ignore */
    }
  });
  ws.addEventListener("error", () => {
    if (closed) return;
    callbacks.onError?.(new Error(m.admin_common_websocket_failed()));
  });
  ws.addEventListener("close", () => {
    if (closed) return;
    callbacks.onComplete?.();
  });

  return {
    unsubscribe: () => {
      closed = true;
      ws?.close();
    },
  };
}

export async function terminalWrite(conversationId: string, data: string): Promise<void> {
  const res = await fetch(`/api/studio/terminal/${encodeURIComponent(conversationId)}/write`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ data }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
}

export async function terminalResize(
  conversationId: string,
  cols: number,
  rows: number,
): Promise<void> {
  const res = await fetch(`/api/studio/terminal/${encodeURIComponent(conversationId)}/resize`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ cols, rows }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
}

export async function terminalClose(conversationId: string): Promise<void> {
  const res = await fetch(`/api/studio/terminal/${encodeURIComponent(conversationId)}/close`, {
    method: "POST",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
}

export function subscribeConversationEvents(
  conversationId: string,
  onUpdate: () => void,
): { unsubscribe: () => void } {
  return sap().subscribeConversationEvents(conversationId, onUpdate);
}

export { STUDIO_PAIR_PLATFORM };
