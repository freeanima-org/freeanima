import type { HabitatClientProfile } from "@freeanima/shared/habitat-contract";
import {
  getHabitatMethodDef,
  isHabitatMethod,
  type HabitatMethod,
} from "@freeanima/shared/habitat-contract";
import type { RpcClient } from "@freeanima/shared/habitat-rpc";

import {
  createHabitatClient,
  type HabitatCallOptions,
  type HabitatClient,
  type HabitatHttpFetch,
} from "./client.ts";

export type HabitatSubscribeCallbacks<T> = {
  onData?: (data: T) => void;
  onError?: (err: Error) => void;
  onComplete?: () => void;
};

export type HabitatSubscribeOptions = {
  transport?: "auto" | "http" | "ws";
  profile?: HabitatClientProfile;
};

export function createHabitatSubscriber(options: {
  httpOrigin: string;
  authToken?: string;
  fetch?: HabitatHttpFetch;
  getRpcClient: () => Promise<RpcClient>;
  profile?: HabitatClientProfile;
}) {
  function subscribe(
    method: HabitatMethod,
    input: Record<string, unknown>,
    callbacks: HabitatSubscribeCallbacks<unknown>,
    _opts: HabitatSubscribeOptions = {},
  ): { unsubscribe: () => void } {
    if (!isHabitatMethod(method)) {
      throw new Error(`unknown habitat method: ${String(method)}`);
    }
    const def = getHabitatMethodDef(method);
    def.input.parse(input);

    if (!def.meta.transports.includes("ws")) {
      throw new Error(`method ${method} does not support WS subscribe`);
    }

    let cancelled = false;
    void (async () => {
      try {
        const rpc = await options.getRpcClient();
        if (
          method === "conversation.subscribe" ||
          method === "conversation.subscribeInbox" ||
          method === "notification.subscribeInbox" ||
          method === "task.subscribeAdvanceReminders"
        ) {
          await rpc.request(method, input);
        }
        const eventMethod =
          method === "conversation.subscribe" || method === "conversation.subscribeInbox"
            ? "conversation.updated"
            : method === "notification.subscribeInbox"
              ? "notification.created"
              : method === "task.subscribeAdvanceReminders"
                ? "task.advanceReminder"
                : method;
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

export function createFullHabitatClient(
  options: Parameters<typeof createHabitatClient>[0] &
    Parameters<typeof createHabitatSubscriber>[0],
): HabitatClient & ReturnType<typeof createHabitatSubscriber> {
  const api = createHabitatClient(options);
  const sub = createHabitatSubscriber(options);
  return Object.assign(api, sub);
}

export type { HabitatCallOptions };
