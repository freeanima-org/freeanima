import type {
  FridgeMagnetsResponse,
  SessionAcpDockSnapshot,
  SessionListItem,
  StreamApiEvent,
} from "./types.ts";
import { getSapBrowserClient, parlorPlatform } from "./sap-client.ts";
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
      platform: s.platform ?? parlorPlatform(),
      created: s.updated_at ?? "",
    })),
  };
}

async function sap() {
  return getSapBrowserClient().whenReady();
}

export type { SessionAcpDockSnapshot, StreamApiEvent } from "./types.ts";

export async function listSessions(platform?: string) {
  const result = await (
    await sap()
  ).request("session.list", {
    platform: platform ?? parlorPlatform(),
  });
  return mapSessionList(result);
}

export async function createSession(platform?: string) {
  const result = await (
    await sap()
  ).request("session.create", {
    platform: platform ?? parlorPlatform(),
  });
  return { session_id: result.session_id };
}

export async function getSessionMessages(sessionId: string, offset = 0, limit = 500) {
  return (await sap()).request("session.messages", {
    session_id: sessionId,
    offset,
    limit,
  });
}

export async function setSessionTitle(sessionId: string, title: string) {
  await (await sap()).request("session.patchTitle", { session_id: sessionId, title });
  return { ok: true as const };
}

export async function getSessionAcpDock(sessionId: string): Promise<SessionAcpDockSnapshot> {
  return (await sap()).request("session.acpDock", { session_id: sessionId });
}

export async function listSessionCommands(opts?: { all?: boolean; platform?: string }) {
  return (await sap()).request("session.commands", {
    platform: opts?.platform ?? parlorPlatform(),
    all: opts?.all,
  });
}

export async function getFridgeMagnets(): Promise<FridgeMagnetsResponse> {
  const result = await (await sap()).request("fridge.list", {});
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
  return getSapBrowserClient().sendMessageStream(input, callbacks);
}

export function subscribeSessionEvents(
  sessionId: string,
  onUpdate: () => void,
): { unsubscribe: () => void } {
  return getSapBrowserClient().subscribeSessionEvents(sessionId, onUpdate);
}

export async function loadConfig() {
  const res = await fetch("/config.json");
  if (!res.ok) {
    throw new Error(m.webui_common_network_error());
  }
  return res.json() as Promise<{
    app_id: string;
    instance_id: string;
    hub_ws_url: string;
    http_url: string;
  }>;
}
