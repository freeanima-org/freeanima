import type { SapClient } from "./router.ts";
import type { StreamApiLikeEvent } from "./frames/message.ts";
import { createSapRelayClient, type SapRelayClient } from "./relay-client.ts";
import { createSapSessionStreamClient, type SubscribeCallbacks } from "./session-stream-core.ts";
import { resolveRelayWsUrl } from "./urls.ts";

export type SapSidecarClientOptions = {
  relayWsUrl?: string;
  configUrl?: string;
  signal?: AbortSignal;
};

export type SapSidecarClient = {
  whenReady(): Promise<SapRelayClient>;
  stop(): void;
  subscribeSessionEvents(sessionId: string, onUpdate: () => void): { unsubscribe: () => void };
  sendMessageStream(
    input: { sessionId: string; message: string },
    callbacks: SubscribeCallbacks<StreamApiLikeEvent>,
  ): { unsubscribe: () => void };
};

export function createSapSidecarClient(options: SapSidecarClientOptions = {}): SapSidecarClient {
  let relay: SapRelayClient | null = null;
  let initPromise: Promise<void> | null = null;

  const ensureRelay = async (): Promise<SapClient> => {
    if (relay) {
      await relay.whenReady();
      return relay;
    }
    if (!initPromise) {
      initPromise = (async () => {
        let relayUrl = options.relayWsUrl;
        if (!relayUrl && options.configUrl) {
          const res = await fetch(options.configUrl);
          const raw = (await res.json()) as { relay_ws_url?: string };
          relayUrl = raw.relay_ws_url?.trim();
        }
        relayUrl ??= resolveRelayWsUrl();
        const ws = new WebSocket(relayUrl);
        await new Promise<void>((resolve, reject) => {
          ws.addEventListener("open", () => resolve(), { once: true });
          ws.addEventListener("error", () => reject(new Error("SAP relay WebSocket open failed")), {
            once: true,
          });
          options.signal?.addEventListener("abort", () => reject(new Error("aborted")), {
            once: true,
          });
        });
        relay = createSapRelayClient({ ws });
        await relay.whenReady();
      })();
    }
    await initPromise;
    return relay!;
  };

  const stream = createSapSessionStreamClient(() => ensureRelay());

  return {
    whenReady: async () => {
      await ensureRelay();
      return relay!;
    },
    stop(): void {
      stream.detach();
      relay?.close();
      relay = null;
      initPromise = null;
    },
    subscribeSessionEvents: stream.subscribeSessionEvents.bind(stream),
    sendMessageStream: stream.sendMessageStream.bind(stream),
  };
}

/** @deprecated Use createSapSidecarClient */
export const createSapRelayBrowserClient = createSapSidecarClient;

export type SapRelayBrowserClient = SapSidecarClient;
export type SapRelayBrowserClientOptions = SapSidecarClientOptions;
