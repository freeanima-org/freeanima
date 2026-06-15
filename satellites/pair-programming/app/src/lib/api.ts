import type { StreamApiEvent } from "./types.ts";
import { m } from "./i18n.ts";
import { createSapRelayBrowserClient, type SapRelayBrowserClient } from "@freeanima/sap-contract";
import { STUDIO_PAIR_PLATFORM } from "@/stores/pair-programming.ts";

type SubscribeCallbacks<T> = {
  onData?: (data: T) => void;
  onError?: (err: Error) => void;
  onComplete?: () => void;
};

let relayClient: SapRelayBrowserClient | null = null;

function sap(): SapRelayBrowserClient {
  if (!relayClient) {
    relayClient = createSapRelayBrowserClient();
  }
  return relayClient;
}

async function apiJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init);
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error ?? `HTTP ${res.status}`);
  }
  return (await res.json()) as T;
}

function mapSessionList(raw: {
  sessions: Array<{
    session_id: string;
    title?: string;
    platform?: string;
    updated_at?: string;
  }>;
}) {
  return {
    sessions: raw.sessions.map((s) => ({
      id: s.session_id,
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

export async function listSessions(platform: string) {
  const client = await sap().whenReady();
  const result = await client.request("session.list", { platform });
  return mapSessionList(result);
}

export async function createSession(platform: string) {
  const client = await sap().whenReady();
  const cfg = await getStudioConfig();
  const result = await client.request("session.create", {
    platform,
    workspace_root: String(cfg.workspace ?? "") || undefined,
    workspace_gitignore: Boolean(cfg.gitignore),
    workspace_show_hidden: Boolean(cfg.showHidden),
  });
  return { session_id: result.session_id };
}

export async function getSessionMessages(sessionId: string, offset?: number, limit?: number) {
  const client = await sap().whenReady();
  return client.request("session.messages", {
    session_id: sessionId,
    offset: offset ?? 0,
    limit: limit ?? 500,
  });
}

export async function setSessionTitle(sessionId: string, title: string) {
  const client = await sap().whenReady();
  await client.request("session.patchTitle", { session_id: sessionId, title });
  return { ok: true as const };
}

export function subscribeMessageStream(
  input: { sessionId: string; message: string },
  callbacks: SubscribeCallbacks<StreamApiEvent>,
): { unsubscribe: () => void } {
  return sap().sendMessageStream(input, callbacks);
}

type TerminalStreamEvent = {
  type: string;
  sessionId?: string;
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
    callbacks.onError?.(new Error(m.webui_common_websocket_failed()));
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

export async function terminalWrite(sessionId: string, data: string): Promise<void> {
  const res = await fetch(`/api/studio/terminal/${encodeURIComponent(sessionId)}/write`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ data }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
}

export async function terminalResize(sessionId: string, cols: number, rows: number): Promise<void> {
  const res = await fetch(`/api/studio/terminal/${encodeURIComponent(sessionId)}/resize`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ cols, rows }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
}

export async function terminalClose(sessionId: string): Promise<void> {
  const res = await fetch(`/api/studio/terminal/${encodeURIComponent(sessionId)}/close`, {
    method: "POST",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
}

export function subscribeSessionEvents(
  sessionId: string,
  onUpdate: () => void,
): { unsubscribe: () => void } {
  return sap().subscribeSessionEvents(sessionId, onUpdate);
}

export { STUDIO_PAIR_PLATFORM };
