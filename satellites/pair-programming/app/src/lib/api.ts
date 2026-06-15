import type { StreamApiEvent } from "./types.ts";
import { m } from "./i18n.ts";

type SubscribeCallbacks<T> = {
  onData?: (data: T) => void;
  onError?: (err: Error) => void;
  onComplete?: () => void;
};

async function apiJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init);
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error ?? `HTTP ${res.status}`);
  }
  return (await res.json()) as T;
}

function parseSseJsonFrames(buffer: string, onFrame: (json: string) => void): string {
  const parts = buffer.split("\n\n");
  const rest = parts.pop() ?? "";
  for (const part of parts) {
    if (part.startsWith(":")) continue;
    const line = part.trim();
    if (!line.startsWith("data:")) continue;
    const json = line.slice(5).trim();
    if (!json) continue;
    onFrame(json);
  }
  return rest;
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
  return apiJson<{ sessions: unknown[] }>(`/api/sessions?platform=${encodeURIComponent(platform)}`);
}

export async function createSession(platform: string) {
  return apiJson<{ session_id: string }>("/api/sessions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ platform }),
  });
}

export async function getSessionMessages(sessionId: string, offset?: number, limit?: number) {
  const params = new URLSearchParams();
  if (offset !== undefined) params.set("offset", String(offset));
  if (limit !== undefined) params.set("limit", String(limit));
  const qs = params.toString();
  return apiJson<Record<string, unknown>>(
    `/api/sessions/${encodeURIComponent(sessionId)}/messages${qs ? `?${qs}` : ""}`,
  );
}

export async function setSessionTitle(sessionId: string, title: string) {
  return apiJson<{ ok: boolean }>(`/api/sessions/${encodeURIComponent(sessionId)}/title`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title }),
  });
}

export function subscribeMessageStream(
  input: { sessionId: string; message: string },
  callbacks: SubscribeCallbacks<StreamApiEvent>,
): { unsubscribe: () => void } {
  const controller = new AbortController();

  void (async () => {
    try {
      const res = await fetch("/api/messages/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
        body: JSON.stringify(input),
        signal: controller.signal,
      });
      if (!res.ok) {
        callbacks.onError?.(new Error(`HTTP ${res.status}`));
        return;
      }
      const reader = res.body?.getReader();
      if (!reader) {
        callbacks.onError?.(new Error(m.webui_common_no_response_stream()));
        return;
      }
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        buffer = parseSseJsonFrames(buffer, (json) => {
          try {
            const ev = JSON.parse(json) as StreamApiEvent;
            if (ev.event === "ping") return;
            callbacks.onData?.(ev);
          } catch {
            /* ignore malformed frame */
          }
        });
      }
      callbacks.onComplete?.();
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") return;
      callbacks.onError?.(e instanceof Error ? e : new Error(String(e)));
    }
  })();

  return { unsubscribe: () => controller.abort() };
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
  let closed = false;
  let controller: AbortController | null = null;

  void (async () => {
    while (!closed) {
      controller = new AbortController();
      try {
        const res = await fetch(`/api/sessions/${encodeURIComponent(sessionId)}/events`, {
          signal: controller.signal,
          headers: { Accept: "text/event-stream" },
        });
        if (!res.ok) return;
        const reader = res.body?.getReader();
        if (!reader) return;
        const decoder = new TextDecoder();
        let buffer = "";
        while (!closed) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split("\n\n");
          buffer = parts.pop() ?? "";
          for (const part of parts) {
            if (part.includes("event: session.updated")) onUpdate();
          }
        }
      } catch {
        if (closed) return;
        await new Promise((r) => setTimeout(r, 2000));
      }
    }
  })();

  return {
    unsubscribe: () => {
      closed = true;
      controller?.abort();
    },
  };
}
