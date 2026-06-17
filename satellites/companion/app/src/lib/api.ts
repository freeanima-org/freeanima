import { isTauri } from "./tauri.ts";
import { resolveSidecarOrigin } from "./sidecar.ts";

let sidecarOrigin: string | null = null;

async function origin(): Promise<string> {
  if (!sidecarOrigin) {
    sidecarOrigin = await resolveSidecarOrigin();
  }
  return sidecarOrigin;
}

async function apiJson<T>(path: string, init?: RequestInit): Promise<T> {
  const base = await origin();
  const res = await fetch(`${base}${path}`, init);
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
    model_available: boolean;
  }>("/config.json");
}

export async function getSettings() {
  return apiJson<{ hub_url: string; model_path: string; model_available: boolean }>("/api/config");
}

export async function saveSettings(patch: { hub_url?: string; model_path?: string }) {
  return apiJson<{ hub_url: string; model_path: string; model_available: boolean }>("/api/config", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
}

export async function uploadModel(file: File) {
  const base = await origin();
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${base}/api/models/upload`, { method: "POST", body: form });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error ?? `HTTP ${res.status}`);
  }
  return (await res.json()) as { model_path: string; filename: string };
}

export async function subscribePetEvents(
  onEvent: (event: unknown) => void,
): Promise<{ unsubscribe: () => void }> {
  const base = await origin();
  const wsUrl = base.replace(/^http/, "ws") + "/api/pet/ws";
  const ws = new WebSocket(wsUrl);
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

export { isTauri };
