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
  subscribeSessionEvents(sessionId: string, onUpdate: () => void): { unsubscribe: () => void };
  sendMessageStream(
    input: { sessionId: string; message: string },
    callbacks: SubscribeCallbacks<StreamApiLikeEvent>,
  ): { unsubscribe: () => void };
};

export function createSapRelayBrowserClient(
  options: SapRelayBrowserClientOptions = {},
): SapRelayBrowserClient {
  let relay: SapRelayClient | null = null;
  let ws: WebSocket | null = null;
  let initPromise: Promise<void> | null = null;
  const subscribedSessions = new Set<string>();
  const sessionListeners = new Map<string, Set<() => void>>();
  let sessionUpdatedOff: (() => void) | null = null;

  const notifySession = (sessionId: string): void => {
    for (const listener of sessionListeners.get(sessionId) ?? []) {
      listener();
    }
  };

  const resubscribeSessions = async (client: SapClient): Promise<void> => {
    for (const sessionId of subscribedSessions) {
      await client.request("session.subscribe", { session_id: sessionId });
    }
  };

  const attachSessionUpdated = (client: SapClient): void => {
    sessionUpdatedOff?.();
    sessionUpdatedOff = client.onEvent("session.updated", (payload) => {
      const record = payload as { session_id?: string };
      if (typeof record.session_id === "string") {
        notifySession(record.session_id);
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
      sessionUpdatedOff?.();
      sessionUpdatedOff = null;
      relay?.close();
      relay = null;
      ws = null;
      initPromise = null;
    },
    subscribeSessionEvents(sessionId, onUpdate) {
      subscribedSessions.add(sessionId);
      let set = sessionListeners.get(sessionId);
      if (!set) {
        set = new Set();
        sessionListeners.set(sessionId, set);
      }
      set.add(onUpdate);

      void ensureRelay().then((client) =>
        client.request("session.subscribe", { session_id: sessionId }),
      );

      return {
        unsubscribe: () => {
          set?.delete(onUpdate);
          if (set && set.size === 0) {
            sessionListeners.delete(sessionId);
            subscribedSessions.delete(sessionId);
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
            session_id: input.sessionId,
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
