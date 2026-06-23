import {
  createSapDirectClient,
  formatSapPlatform,
  resolveHubWsUrl,
  type SapClient,
  type SapConnectionState,
  type SapDirectClient,
  type SapInstanceStore,
} from "@freeanima/sap-contract";

const APP_ID = "chat";

let directClient: SapDirectClient | null = null;
let connectionState: SapConnectionState = "connecting";
const connectionListeners = new Set<(state: SapConnectionState) => void>();

function notifyConnection(state: SapConnectionState): void {
  connectionState = state;
  for (const listener of connectionListeners) {
    listener(state);
  }
}

function resolveHubWsUrlFromEnv(): string {
  const shell = window.satelliteShell ?? window.companionShell;
  if (shell?.hubWsUrl) return shell.hubWsUrl;
  const env = (import.meta as ImportMeta & { env?: { VITE_FREEANIMA_HUB_WS?: string } }).env;
  if (env?.VITE_FREEANIMA_HUB_WS?.trim()) return env.VITE_FREEANIMA_HUB_WS.trim();
  return resolveHubWsUrl("http://127.0.0.1:2658");
}

function resolveInstanceStore(): SapInstanceStore | undefined {
  const shell = window.satelliteShell ?? window.companionShell;
  if (shell?.createFileInstanceStore) {
    return shell.createFileInstanceStore(APP_ID);
  }
  return undefined;
}

export function getSapDirectClient(): SapDirectClient {
  if (!directClient) {
    notifyConnection("connecting");
    directClient = createSapDirectClient({
      appId: APP_ID,
      hubWsUrl: resolveHubWsUrlFromEnv(),
      instanceStore: resolveInstanceStore(),
      useSharedWorker: resolveInstanceStore() === undefined,
    });
    void directClient
      .whenReady()
      .then(() => notifyConnection("connected"))
      .catch(() => notifyConnection("disconnected"));
  }
  return directClient;
}

/** @deprecated 使用 getSapDirectClient */
export const getSapRelayClient = getSapDirectClient;

export function getSapConnectionState(): SapConnectionState {
  return connectionState;
}

export function subscribeSapConnection(listener: (state: SapConnectionState) => void): () => void {
  connectionListeners.add(listener);
  listener(connectionState);
  return () => {
    connectionListeners.delete(listener);
  };
}

export async function reconnectSap(): Promise<void> {
  directClient?.stop();
  directClient = null;
  notifyConnection("connecting");
  getSapDirectClient();
  await getSapDirectClient().whenReady();
  notifyConnection("connected");
}

export async function loadChatInstanceId(): Promise<string | null> {
  const client = getSapDirectClient();
  try {
    await client.whenReady();
    return client.getInstanceId();
  } catch {
    return client.getInstanceId();
  }
}

export async function chatPlatform(): Promise<string> {
  const instanceId = await loadChatInstanceId();
  if (!instanceId) {
    throw new Error("Chat instance_id 未就绪；请确认 Hub 已运行且 SAP 已连接");
  }
  return formatSapPlatform(APP_ID, instanceId);
}

export async function whenSapClientReady(): Promise<SapClient> {
  return getSapDirectClient().whenReady();
}

/** 测试用：重置 module 级缓存 */
export function resetChatInstanceCacheForTests(): void {
  directClient?.stop();
  directClient = null;
  connectionListeners.clear();
  connectionState = "connecting";
}
