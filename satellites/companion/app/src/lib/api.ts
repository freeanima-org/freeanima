import { createSapRelayBrowserClient, type SapRelayBrowserClient } from "@freeanima/sap-contract";
import type { StreamApiEvent } from "./types.ts";
import { COMPANION_PLATFORM } from "./types.ts";

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

export async function fetchConfig() {
  return apiJson<{
    app_id: string;
    instance_id: string;
    relay_ws_url: string;
    hub_url: string;
    model_path: string;
  }>("/config.json");
}

export async function getSettings() {
  return apiJson<{ hub_url: string; model_path: string }>("/api/config");
}

export async function saveSettings(patch: { hub_url?: string; model_path?: string }) {
  return apiJson<{ hub_url: string; model_path: string }>("/api/config", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
}

export async function uploadModel(file: File) {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch("/api/models/upload", { method: "POST", body: form });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error ?? `HTTP ${res.status}`);
  }
  return (await res.json()) as { model_path: string; filename: string };
}

export async function createSession() {
  const client = await sap().whenReady();
  const result = await client.request("session.create", {
    platform: COMPANION_PLATFORM,
  });
  return { session_id: result.session_id };
}

export function subscribeMessageStream(
  input: { sessionId: string; message: string },
  callbacks: SubscribeCallbacks<StreamApiEvent>,
): { unsubscribe: () => void } {
  return sap().sendMessageStream(input, callbacks);
}

export function subscribeSessionEvents(
  sessionId: string,
  onUpdate: () => void,
): { unsubscribe: () => void } {
  return sap().subscribeSessionEvents(sessionId, onUpdate);
}

export function subscribePetEvents(onEvent: (event: unknown) => void): { unsubscribe: () => void } {
  const proto = location.protocol === "https:" ? "wss:" : "ws:";
  const ws = new WebSocket(`${proto}//${location.host}/api/pet/ws`);
  ws.addEventListener("message", (ev) => {
    if (typeof ev.data !== "string") return;
    try {
      onEvent(JSON.parse(ev.data));
    } catch {
      /* ignore */
    }
  });
  return {
    unsubscribe: () => ws.close(),
  };
}

export { COMPANION_PLATFORM };
