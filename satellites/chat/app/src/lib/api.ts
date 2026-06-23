import type {
  FridgeMagnetsResponse,
  SessionAcpDockSnapshot,
  SessionListItem,
  StreamApiEvent,
} from "./types.ts";
import { getSapRelayClient } from "./sap-client.ts";
import { m } from "./i18n.ts";

type SubscribeCallbacks<T> = {
  onData?: (data: T) => void;
  onError?: (err: Error) => void;
  onComplete?: () => void;
};

function mapSessionList(raw: {
  sessions: Array<{
    session_id: string;
    title?: string;
    platform?: string;
    updated_at?: string;
  }>;
}): { sessions: SessionListItem[] } {
  return {
    sessions: raw.sessions.map((s) => ({
      id: s.session_id,
      title: s.title ?? "",
      platform: s.platform ?? "",
      created: s.updated_at ?? "",
    })),
  };
}

function sap() {
  return getSapRelayClient();
}

export type { SessionAcpDockSnapshot, StreamApiEvent } from "./types.ts";

export async function listSessions() {
  const client = await sap().whenReady();
  const result = await client.request("session.list", {});
  return mapSessionList(result);
}

export async function createSession() {
  const client = await sap().whenReady();
  const result = await client.request("session.create", {});
  return { session_id: result.session_id };
}

export async function getSessionMessages(sessionId: string, offset = 0, limit = 500) {
  const client = await sap().whenReady();
  return client.request("session.messages", {
    session_id: sessionId,
    offset,
    limit,
  });
}

export async function setSessionTitle(sessionId: string, title: string) {
  const client = await sap().whenReady();
  await client.request("session.patchTitle", { session_id: sessionId, title });
  return { ok: true as const };
}

export async function getSessionAcpDock(sessionId: string): Promise<SessionAcpDockSnapshot> {
  const client = await sap().whenReady();
  return client.request("session.acpDock", { session_id: sessionId });
}

export async function listSessionCommands(opts?: { all?: boolean }) {
  const client = await sap().whenReady();
  return client.request("session.commands", {
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
  input: { sessionId: string; message: string },
  callbacks: SubscribeCallbacks<StreamApiEvent>,
): { unsubscribe: () => void } {
  return sap().sendMessageStream(input, callbacks);
}

export async function interruptMessageStream(sessionId: string): Promise<void> {
  const client = await sap().whenReady();
  await client.request("message.interrupt", { session_id: sessionId });
}

export function subscribeSessionEvents(
  sessionId: string,
  onUpdate: () => void,
): { unsubscribe: () => void } {
  return sap().subscribeSessionEvents(sessionId, onUpdate);
}

export async function loadConfig() {
  const res = await fetch("/config.json");
  if (!res.ok) {
    throw new Error(m.webui_common_network_error());
  }
  return res.json() as Promise<{
    app_id: string;
    instance_id: string;
    relay_ws_url: string;
  }>;
}
