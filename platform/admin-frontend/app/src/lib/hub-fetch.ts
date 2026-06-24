import { apiPath } from "./api-path.ts";

type HubShell = {
  hubFetch?: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
};

export function resolveHubFetch(): (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response> {
  const shell = (typeof window !== "undefined" ? window.satelliteShell : undefined) as
    | HubShell
    | undefined;
  return (shell?.hubFetch ?? fetch) as typeof fetch;
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
    } catch {
      /* 断开或 abort */
    }
  })();
  return {
    unsubscribe: () => controller.abort(),
  };
}
