import type { SapClient } from "./router.ts";
import type { StreamApiLikeEvent } from "./frames/message.ts";
import { mapSapStreamMethodToApi, streamEventMethods } from "./frames/message.ts";
import { runSapTransport, type SapTransportHandle } from "./transport.ts";

export type ParlorSatelliteConfig = {
  hub_ws_url: string;
  instance_id: string;
  app_id: string;
};

export type SapBrowserClientOptions = {
  configUrl?: string;
  httpUrl?: string;
  appId?: string;
  instanceId?: string;
  hubWsUrl?: string;
  featuresRequested?: string[];
  signal?: AbortSignal;
};

export type SubscribeCallbacks<T> = {
  onData?: (data: T) => void;
  onError?: (err: Error) => void;
  onComplete?: () => void;
};

export type SapBrowserClient = {
  whenReady(): Promise<SapClient>;
  getClient(): SapClient | null;
  stop(): void;
  subscribeSessionEvents(sessionId: string, onUpdate: () => void): { unsubscribe: () => void };
  sendMessageStream(
    input: { sessionId: string; message: string },
    callbacks: SubscribeCallbacks<StreamApiLikeEvent>,
  ): { unsubscribe: () => void };
};

const DEFAULT_CONFIG_URL = "/config.json";
const PARLOR_PLATFORM = "parlor";

function hubHttpFromWs(wsUrl: string): string {
  return wsUrl.replace(/^ws/, "http").replace(/\/sap\/v1\/?$/, "");
}

export async function loadParlorSatelliteConfig(
  configUrl = DEFAULT_CONFIG_URL,
): Promise<ParlorSatelliteConfig> {
  const res = await fetch(configUrl);
  if (!res.ok) {
    throw new Error(`加载 config 失败: HTTP ${res.status}`);
  }
  const raw = (await res.json()) as Partial<ParlorSatelliteConfig>;
  if (!raw.hub_ws_url?.trim() || !raw.instance_id?.trim()) {
    throw new Error("config.json 缺少 hub_ws_url 或 instance_id");
  }
  return {
    hub_ws_url: raw.hub_ws_url.trim(),
    instance_id: raw.instance_id.trim(),
    app_id: raw.app_id?.trim() || "parlor",
  };
}

export function createSapBrowserClient(options: SapBrowserClientOptions = {}): SapBrowserClient {
  let transport: SapTransportHandle | null = null;
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

  const ensureTransport = async (): Promise<SapClient> => {
    if (transport?.getClient()) {
      return transport.whenConnected();
    }
    if (!initPromise) {
      initPromise = (async () => {
        const loaded =
          options.hubWsUrl && options.instanceId
            ? {
                hub_ws_url: options.hubWsUrl,
                instance_id: options.instanceId,
                app_id: options.appId ?? "parlor",
              }
            : await loadParlorSatelliteConfig(options.configUrl);

        const httpUrl =
          options.httpUrl ?? (typeof window !== "undefined" ? window.location.origin : undefined);

        transport = runSapTransport({
          hubUrl: hubHttpFromWs(loaded.hub_ws_url),
          signal: options.signal,
          connect: {
            app_id: options.appId ?? loaded.app_id,
            instance_id: options.instanceId ?? loaded.instance_id,
            features_requested: options.featuresRequested ?? ["server_info"],
            ...(httpUrl ? { http_url: httpUrl } : {}),
          },
          onConnected: async (client) => {
            attachSessionUpdated(client);
            await resubscribeSessions(client);
          },
        });
      })();
    }
    await initPromise;
    return transport!.whenConnected();
  };

  return {
    whenReady: ensureTransport,
    getClient(): SapClient | null {
      return transport?.getClient() ?? null;
    },
    stop(): void {
      sessionUpdatedOff?.();
      sessionUpdatedOff = null;
      transport?.stop();
      transport = null;
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

      void ensureTransport().then((client) =>
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
          const client = await ensureTransport();
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

export { PARLOR_PLATFORM };
