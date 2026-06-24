import type { SapClient } from "./router.ts";
import type { StreamApiLikeEvent } from "./frames/message.ts";
import {
  createSapConversationStreamClient,
  type SubscribeCallbacks,
} from "./conversation-stream-core.ts";
import { runSapTransport, type SapTransportHandle } from "./transport.ts";
import {
  browserSapInstanceStore,
  browserSapInstanceStoreKey,
  loadSapInstanceId,
  type SapInstanceStore,
} from "./instance-store.ts";
import { hubHttpFromWsUrl, resolveHubWsUrl } from "./urls.ts";
import { resolveShellConnectAuthToken } from "./remote-auth-client.ts";
import { createSharedWorkerSapClient } from "./shared-worker.ts";

export type DirectSatelliteConfig = {
  hub_ws_url: string;
  app_id: string;
  instance_id?: string;
};

export type SapDirectClientOptions = {
  configUrl?: string;
  httpUrl?: string;
  appId?: string;
  hubWsUrl?: string;
  featuresRequested?: string[];
  instanceStore?: SapInstanceStore;
  signal?: AbortSignal;
  /** SharedWorker script URL; default `/sap-shared-worker.js` in browser */
  sharedWorkerUrl?: string;
  /** Use SharedWorker for multi-tab single Hub connection (default true in browser) */
  useSharedWorker?: boolean;
  /** Hub remote_auth token for non-loopback SAP connect */
  remoteAuthToken?: string;
};

export type SapDirectClient = {
  whenReady(): Promise<SapClient>;
  getClient(): SapClient | null;
  getInstanceId(): string | null;
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

const DEFAULT_CONFIG_URL = "/config.json";

export async function loadDirectSatelliteConfig(
  configUrl = DEFAULT_CONFIG_URL,
): Promise<DirectSatelliteConfig> {
  const res = await fetch(configUrl);
  if (!res.ok) {
    throw new Error(`加载 config 失败: HTTP ${res.status}`);
  }
  const raw = (await res.json()) as Partial<DirectSatelliteConfig>;
  if (!raw.hub_ws_url?.trim()) {
    throw new Error("config.json 缺少 hub_ws_url");
  }
  return {
    hub_ws_url: raw.hub_ws_url.trim(),
    app_id: raw.app_id?.trim() || "chat",
    instance_id: raw.instance_id?.trim(),
  };
}

export function createSapDirectClient(options: SapDirectClientOptions = {}): SapDirectClient {
  let transport: SapTransportHandle | null = null;
  let sharedClient: ReturnType<typeof createSharedWorkerSapClient> | null = null;
  let initPromise: Promise<void> | null = null;
  let instanceId: string | null = null;
  const useSharedWorker =
    typeof SharedWorker !== "undefined" &&
    typeof window !== "undefined" &&
    options.useSharedWorker !== false &&
    options.instanceStore === undefined;

  const ensureTransport = async (): Promise<SapClient> => {
    if (sharedClient) return sharedClient;
    if (transport?.getClient()) {
      return transport.whenConnected();
    }
    if (!initPromise) {
      initPromise = (async () => {
        const loaded = options.hubWsUrl
          ? {
              hub_ws_url: options.hubWsUrl,
              app_id: options.appId ?? "chat",
            }
          : await loadDirectSatelliteConfig(options.configUrl);

        const hubHttp = hubHttpFromWsUrl(loaded.hub_ws_url);
        const httpUrl =
          options.httpUrl ?? (typeof window !== "undefined" ? window.location.origin : undefined);

        const hubOrigin = hubHttpFromWsUrl(resolveHubWsUrl(hubHttp));
        const store =
          options.instanceStore ??
          (typeof window !== "undefined"
            ? browserSapInstanceStore(hubOrigin, options.appId ?? loaded.app_id)
            : undefined);

        const storedId = (await loadSapInstanceId(store)) ?? loaded.instance_id ?? null;
        const connect = {
          app_id: options.appId ?? loaded.app_id,
          ...(storedId ? { instance_id: storedId } : {}),
          features_requested: options.featuresRequested ?? ["server_info"],
          ...(httpUrl ? { http_url: httpUrl } : {}),
          ...((): { auth_token?: string } => {
            const authToken = options.remoteAuthToken ?? resolveShellConnectAuthToken(hubHttp);
            return authToken ? { auth_token: authToken } : {};
          })(),
        };

        if (useSharedWorker) {
          const worker = new SharedWorker(options.sharedWorkerUrl ?? "/sap-shared-worker.js", {
            type: "module",
            name: `freeanima-sap-${connect.app_id}`,
          });
          sharedClient = createSharedWorkerSapClient({
            worker,
            initConfig: {
              hubUrl: hubHttp,
              instanceStoreKey: browserSapInstanceStoreKey(
                hubOrigin,
                options.appId ?? loaded.app_id,
              ),
              connect,
            },
          });
          const connected = await sharedClient.connect(connect);
          instanceId = connected.instance_id;
          return;
        }

        transport = runSapTransport({
          hubUrl: hubHttp,
          signal: options.signal,
          instanceStore: store,
          connect,
          onConnected: async (_client, connected) => {
            instanceId = connected.instance_id;
          },
        });
      })();
    }
    await initPromise;
    if (sharedClient) return sharedClient;
    return transport!.whenConnected();
  };

  const stream = createSapConversationStreamClient(() => ensureTransport());

  return {
    whenReady: ensureTransport,
    getClient(): SapClient | null {
      return sharedClient ?? transport?.getClient() ?? null;
    },
    getInstanceId(): string | null {
      return sharedClient?.getInstanceId() ?? instanceId;
    },
    stop(): void {
      stream.detach();
      sharedClient?.close();
      sharedClient = null;
      transport?.stop();
      transport = null;
      initPromise = null;
      instanceId = null;
    },
    subscribeConversationEvents: stream.subscribeConversationEvents.bind(stream),
    sendMessageStream: stream.sendMessageStream.bind(stream),
  };
}

/** @deprecated Use createSapDirectClient */
export const createSapBrowserClient = createSapDirectClient;

/** @deprecated Use loadDirectSatelliteConfig */
export const loadChatSatelliteConfig = loadDirectSatelliteConfig;

export function formatDirectPlatform(appId: string, instanceId: string): string {
  return `sap:${appId.trim().toLowerCase().replace(/[-_]/g, "")}:${instanceId.trim().toLowerCase()}`;
}
