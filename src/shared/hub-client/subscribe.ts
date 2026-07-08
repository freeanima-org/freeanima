import type { HubClientProfile } from "@freeanima/hub-contract";
import { getHubMethodDef, isHubMethod, type HubMethod } from "@freeanima/hub-contract";
import type { RpcClient } from "@freeanima/hub-rpc";

import { createHubClient, type HubCallOptions, type HubClient } from "./client.ts";

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
  function subscribe<K extends HubMethod>(
    method: K,
    input: Record<string, unknown>,
    callbacks: HubSubscribeCallbacks<unknown>,
    _opts: HubSubscribeOptions = {},
  ): { unsubscribe: () => void } {
    if (!isHubMethod(method)) {
      throw new Error(`unknown hub method: ${method}`);
    }
    const def = getHubMethodDef(method);
    def.input.parse(input);

    if (!def.meta.transports.includes("ws")) {
      throw new Error(`method ${method} does not support WS subscribe`);
    }

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
