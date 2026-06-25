import { createBearerFetch, shouldAttachRemoteAuth } from "@freeanima/satellite-sdk";

import { apiPath } from "./api-path.ts";
import { isAbortError, logCaughtError } from "./log-caught-error.ts";
import { resolveApiOrigin } from "./hub-origin.ts";

type HubFetchFn = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export type { HubFetchFn };

type HubShell = {
  hubUrl?: string;
  hubFetch?: HubFetchFn;
  remoteAuth?: { token?: string };
};

let cachedFetch: HubFetchFn | undefined;
let cachedFetchKey = "";

function hubFetchCacheKey(): string {
  const shell = (typeof window !== "undefined" ? window.satelliteShell : undefined) as
    | HubShell
    | undefined;
  const origin = resolveApiOrigin();
  const token = shell?.remoteAuth?.token?.trim() ?? "";
  const bridge = shell?.hubFetch ? "bridge" : "none";
  return `${origin}\0${token}\0${bridge}`;
}

function wrapHubFetch(inner: HubFetchFn): HubFetchFn {
  return async (input, init) => {
    const res = await inner(input, init);
    if (!res) {
      throw new TypeError("Hub fetch 未返回 Response");
    }
    return res;
  };
}

/** bundled 客户端统一 Hub fetch：优先用 renderer 内 Bearer，避免 preload 函数桥接异常 */
export function resolveHubFetch(): HubFetchFn {
  const key = hubFetchCacheKey();
  if (cachedFetch && cachedFetchKey === key) {
    return cachedFetch;
  }

  const shell = (typeof window !== "undefined" ? window.satelliteShell : undefined) as
    | HubShell
    | undefined;
  const origin = resolveApiOrigin();
  const token = shell?.remoteAuth?.token?.trim() ?? "";

  let inner: HubFetchFn;
  if (token && shouldAttachRemoteAuth(origin, token)) {
    inner = createBearerFetch(token, origin);
  } else if (shell?.hubFetch) {
    inner = shell.hubFetch;
  } else {
    inner = fetch;
  }

  cachedFetch = wrapHubFetch(inner);
  cachedFetchKey = key;
  return cachedFetch;
}

export function resetHubFetchCache(): void {
  cachedFetch = undefined;
  cachedFetchKey = "";
}

export function hubApiFetch(path: string, init?: RequestInit): Promise<Response> {
  return resolveHubFetch()(apiPath(path), init);
}

type SseChunk = { event: string; data: string };

function parseSseBuffer(buffer: string): { chunks: SseChunk[]; rest: string } {
  const chunks: SseChunk[] = [];
  let rest = buffer;
  for (;;) {
    const sep = rest.indexOf("\n\n");
    if (sep === -1) break;
    const block = rest.slice(0, sep);
    rest = rest.slice(sep + 2);
    if (!block.trim()) continue;
    let event = "message";
    let data = "";
    for (const line of block.split("\n")) {
      if (line.startsWith("event:")) event = line.slice(6).trim();
      else if (line.startsWith("data:")) data += line.slice(5).trim();
    }
    chunks.push({ event, data });
  }
  return { chunks, rest };
}

/** hubFetch 场景下用 fetch 读 SSE（EventSource 无法带 Authorization） */
export function subscribeHubSse(
  path: string,
  handlers: Record<string, () => void>,
): { unsubscribe: () => void } {
  const controller = new AbortController();
  void (async () => {
    try {
      const res = await hubApiFetch(path, {
        signal: controller.signal,
        headers: { Accept: "text/event-stream" },
      });
      if (!res.ok || !res.body) return;
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parsed = parseSseBuffer(buffer);
        buffer = parsed.rest;
        for (const chunk of parsed.chunks) {
          handlers[chunk.event]?.();
        }
      }
    } catch (err) {
      if (!isAbortError(err)) {
        logCaughtError("hub-fetch/sse", err);
      }
    }
  })();
  return {
    unsubscribe: () => controller.abort(),
  };
}
