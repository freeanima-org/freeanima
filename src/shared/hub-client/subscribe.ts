import type { HubClientProfile } from "@freeanima/hub-contract";
import { getHubMethodDef, isHubMethod, type HubMethod } from "@freeanima/hub-contract";
import type { RpcClient } from "@freeanima/hub-rpc";

import { createHubClient, type HubCallOptions, type HubClient } from "./client.ts";
import { buildHttpUrl } from "./http-path.ts";

export type HubSubscribeCallbacks<T> = {
  onData?: (data: T) => void;
  onError?: (err: Error) => void;
  onComplete?: () => void;
};

export type HubSubscribeOptions = {
  transport?: "auto" | "http" | "ws";
  profile?: HubClientProfile;
};

export function createHubSubscriber(options: {
  httpOrigin: string;
  authToken?: string;
  fetch?: typeof fetch;
  getRpcClient: () => Promise<RpcClient>;
  profile?: HubClientProfile;
}) {
  const profile = options.profile ?? "satellite";
  const httpFetch = options.fetch ?? globalThis.fetch;

  function subscribe<K extends HubMethod>(
    method: K,
    input: Record<string, unknown>,
    callbacks: HubSubscribeCallbacks<unknown>,
    opts: HubSubscribeOptions = {},
  ): { unsubscribe: () => void } {
    if (!isHubMethod(method)) {
      throw new Error(`unknown hub method: ${method}`);
    }
    const def = getHubMethodDef(method);
    def.input.parse(input);

    const transport =
      opts.transport ??
      ((opts.profile ?? profile) === "console" && def.meta.http?.sse ? "http" : "ws");

    if (transport === "ws") {
      let cancelled = false;
      void (async () => {
        try {
          const rpc = await options.getRpcClient();
          if (method === "conversation.subscribe") {
            await rpc.request(method, input);
          }
          const eventMethod =
            method === "conversation.subscribe" ? "conversation.updated" : String(method);
          const off = rpc.onEvent(eventMethod, (payload) => {
            if (!cancelled) callbacks.onData?.(payload);
          });
          return () => {
            cancelled = true;
            off();
          };
        } catch (err) {
          if (!cancelled) {
            callbacks.onError?.(err instanceof Error ? err : new Error(String(err)));
          }
          return () => undefined;
        }
      })();
      return {
        unsubscribe: () => {
          cancelled = true;
        },
      };
    }

    const http = def.meta.http;
    if (!http?.sse) {
      throw new Error(`method ${method} has no HTTP SSE binding`);
    }
    const url = buildHttpUrl(options.httpOrigin, http, input);
    const headers: Record<string, string> = { Accept: "text/event-stream" };
    if (options.authToken?.trim()) {
      headers.Authorization = `Bearer ${options.authToken.trim()}`;
    }
    const controller = new AbortController();
    void (async () => {
      try {
        const res = await httpFetch(url, {
          method: http.method,
          headers,
          signal: controller.signal,
        });
        if (!res.ok || !res.body) {
          throw new Error(`SSE HTTP ${res.status}`);
        }
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split("\n\n");
          buffer = parts.pop() ?? "";
          for (const part of parts) {
            const dataLine = part.split("\n").find((l) => l.startsWith("data:"));
            if (!dataLine) continue;
            const raw = dataLine.slice(5).trim();
            if (!raw) continue;
            try {
              callbacks.onData?.(JSON.parse(raw));
            } catch {
              callbacks.onData?.(raw);
            }
          }
        }
        callbacks.onComplete?.();
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          callbacks.onError?.(err instanceof Error ? err : new Error(String(err)));
        }
      }
    })();
    return {
      unsubscribe: () => controller.abort(),
    };
  }

  return { subscribe };
}

export function createFullHubClient(
  options: Parameters<typeof createHubClient>[0] & Parameters<typeof createHubSubscriber>[0],
): HubClient & ReturnType<typeof createHubSubscriber> {
  const api = createHubClient(options);
  const sub = createHubSubscriber(options);
  return Object.assign(api, sub);
}

export type { HubCallOptions };
