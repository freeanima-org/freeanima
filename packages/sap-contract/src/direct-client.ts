/// <reference lib="dom" />
/// <reference lib="webworker" />
import type { SapClient } from "./router.ts";
import type { StreamApiLikeEvent } from "./frames/message.ts";
import {
  createSapConversationStreamClient,
  type SubscribeCallbacks,
} from "./conversation-stream-core.ts";
import { runSapTransport, type SapTransportHandle } from "./transport.ts";
import type { SapConnectionState } from "./sidecar-client.ts";
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
  /** 固定 instance_id（singleton 策略）；优先于 instanceStore / config */
  instanceId?: string;
  featuresRequested?: string[];
  instanceStore?: SapInstanceStore;
  signal?: AbortSignal;
  /** 覆盖 Vite 构建注入的 SharedWorker URL（测试或自定义部署） */
  sharedWorkerUrl?: string;
  /** Use SharedWorker for multi-tab single Hub connection (default true in browser) */
  useSharedWorker?: boolean;
  /** Hub remote_auth token for non-loopback SAP connect */
  remoteAuthToken?: string;
  /** 连接状态变化（含 SharedWorker / 直连 transport 断线） */
  onConnectionStateChange?: (state: SapConnectionState) => void;
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

let cachedBundledWorkerUrl: string | null = null;

async function resolveSharedWorkerUrl(override?: string): Promise<string> {
  const trimmed = override?.trim();
  if (trimmed) return trimmed;
  if (cachedBundledWorkerUrl) return cachedBundledWorkerUrl;
  const mod = await import("./shared-worker-bundled-url.ts");
  const url = mod.default;
  cachedBundledWorkerUrl = url;
  return url;
}

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
  const instanceId = raw.instance_id?.trim();
  return {
    hub_ws_url: raw.hub_ws_url.trim(),
    app_id: raw.app_id?.trim() || "chat",
    ...(instanceId ? { instance_id: instanceId } : {}),
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
        const fixedInstanceId = options.instanceId?.trim() || null;
        const store =
          fixedInstanceId != null
            ? undefined
            : (options.instanceStore ??
              (typeof window !== "undefined"
                ? browserSapInstanceStore(hubOrigin, options.appId ?? loaded.app_id)
                : undefined));

        const storedId =
          fixedInstanceId ?? (await loadSapInstanceId(store)) ?? loaded.instance_id ?? null;
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
          const workerUrl = await resolveSharedWorkerUrl(options.sharedWorkerUrl);
          const worker = new SharedWorker(workerUrl, {
            type: "module",
            name: `freeanima-sap-${connect.app_id}`,
          });
          sharedClient = createSharedWorkerSapClient({
            worker,
            initConfig: {
              hubUrl: hubHttp,
              ...(store
                ? {
                    instanceStoreKey: browserSapInstanceStoreKey(
                      hubOrigin,
                      options.appId ?? loaded.app_id,
                    ),
                  }
                : {}),
              connect,
            },
            onStateChange: (connected) => {
              options.onConnectionStateChange?.(connected ? "connected" : "disconnected");
            },
          });
          const connected = await sharedClient.connect(connect);
          instanceId = connected.instance_id;
          return;
        }

        transport = runSapTransport({
          hubUrl: hubHttp,
          ...(options.signal !== undefined ? { signal: options.signal } : {}),
          ...(store !== undefined ? { instanceStore: store } : {}),
          connect,
          onConnected: async (_client, connected) => {
            instanceId = connected.instance_id;
            options.onConnectionStateChange?.("connected");
          },
          onDisconnected: () => {
            options.onConnectionStateChange?.("disconnected");
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

export function formatDirectPlatform(appId: string, instanceId: string): string {
  return `sap:${appId.trim().toLowerCase().replace(/[-_]/g, "")}:${instanceId.trim().toLowerCase()}`;
}
