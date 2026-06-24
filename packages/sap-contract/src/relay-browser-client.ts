import type { SapClient } from "./router.ts";
import type { StreamApiLikeEvent } from "./frames/message.ts";
import { mapSapStreamMethodToApi, streamEventMethods } from "./frames/message.ts";
import { createSapRelayClient, resolveSapRelayWsUrl, type SapRelayClient } from "./relay-client.ts";
import type { SubscribeCallbacks } from "./browser-client.ts";

export type SapRelayBrowserClientOptions = {
  relayWsUrl?: string;
  signal?: AbortSignal;
};

export type SapRelayBrowserClient = {
  whenReady(): Promise<SapClient>;
  getClient(): SapClient | null;
  stop(): void;
  subscribeConversationEvents(
    conversationId: string,
    onUpdate: () => void,
  ): { unsubscribe: () => void };
  sendMessageStream(
    input: { conversationId: string; message: string },
    callbacks: SubscribeCallbacks<StreamApiLikeEvent>,
  ): { unsubscribe: () => void };
};

export function createSapRelayBrowserClient(
  options: SapRelayBrowserClientOptions = {},
): SapRelayBrowserClient {
  let relay: SapRelayClient | null = null;
  let ws: WebSocket | null = null;
  let initPromise: Promise<void> | null = null;
  const subscribedConversations = new Set<string>();
  const conversationListeners = new Map<string, Set<() => void>>();
  let conversationUpdatedOff: (() => void) | null = null;

  const notifyConversation = (conversationId: string): void => {
    for (const listener of conversationListeners.get(conversationId) ?? []) {
      listener();
    }
  };

  const resubscribeSessions = async (client: SapClient): Promise<void> => {
    for (const conversationId of subscribedConversations) {
      await client.request("conversation.subscribe", { conversation_id: conversationId });
    }
  };

  const attachSessionUpdated = (client: SapClient): void => {
    conversationUpdatedOff?.();
    conversationUpdatedOff = client.onEvent("conversation.updated", (payload) => {
      const record = payload as { conversation_id?: string };
      if (typeof record.conversation_id === "string") {
        notifyConversation(record.conversation_id);
      }
    });
  };

  const ensureRelay = async (): Promise<SapClient> => {
    if (relay) {
      await relay.whenReady();
      return relay;
    }
    if (!initPromise) {
      initPromise = (async () => {
        const relayUrl =
          options.relayWsUrl ??
          resolveSapRelayWsUrl(typeof window !== "undefined" ? window.location.origin : undefined);
        ws = new WebSocket(relayUrl);
        if (options.signal) {
          options.signal.addEventListener(
            "abort",
            () => {
              ws?.close();
            },
            { once: true },
          );
        }
        await new Promise<void>((resolve, reject) => {
          ws!.addEventListener("open", () => resolve(), { once: true });
          ws!.addEventListener(
            "error",
            () => reject(new Error("SAP relay WebSocket open failed")),
            {
              once: true,
            },
          );
        });
        relay = createSapRelayClient({ ws: ws! });
        await relay.whenReady();
        attachSessionUpdated(relay);
        await resubscribeSessions(relay);
      })();
    }
    await initPromise;
    return relay!;
  };

  return {
    whenReady: ensureRelay,
    getClient(): SapClient | null {
      return relay;
    },
    stop(): void {
      conversationUpdatedOff?.();
      conversationUpdatedOff = null;
      relay?.close();
      relay = null;
      ws = null;
      initPromise = null;
    },
    subscribeConversationEvents(conversationId, onUpdate) {
      subscribedConversations.add(conversationId);
      let set = conversationListeners.get(conversationId);
      if (!set) {
        set = new Set();
        conversationListeners.set(conversationId, set);
      }
      set.add(onUpdate);

      void ensureRelay().then((client) =>
        client.request("conversation.subscribe", { conversation_id: conversationId }),
      );

      return {
        unsubscribe: () => {
          set?.delete(onUpdate);
          if (set && set.size === 0) {
            conversationListeners.delete(conversationId);
            subscribedConversations.delete(conversationId);
          }
        },
      };
    },
    sendMessageStream(input, callbacks) {
      let closed = false;
      const cleanups: Array<() => void> = [];

      const finish = (): void => {
        if (closed) return;
        closed = true;
        for (const off of cleanups) off();
        callbacks.onComplete?.();
      };

      void (async () => {
        try {
          const client = await ensureRelay();
          const { stream_id: streamId } = await client.request("message.send", {
            conversation_id: input.conversationId,
            message: input.message,
          });

          for (const method of streamEventMethods) {
            cleanups.push(
              client.onEvent(method, (payload) => {
                if (closed) return;
                const record = payload as Record<string, unknown>;
                if (record.stream_id !== streamId) return;
                const apiEvent = mapSapStreamMethodToApi(method, record);
                if (!apiEvent || apiEvent.event === "ping") return;
                callbacks.onData?.(apiEvent);
                if (apiEvent.event === "done" || apiEvent.event === "error") {
                  finish();
                }
              }),
            );
          }
        } catch (e) {
          if (!closed) {
            callbacks.onError?.(e instanceof Error ? e : new Error(String(e)));
            finish();
          }
        }
      })();

      return { unsubscribe: finish };
    },
  };
}
