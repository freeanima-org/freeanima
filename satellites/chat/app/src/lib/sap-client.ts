import {
  CHAT_INSTANCE_ID,
  createSapDirectClient,
  formatSapPlatform,
  resolveHubWsUrl,
  type SapClient,
  type SapConnectionState,
  type SapDirectClient,
} from "@freeanima/sap-contract";

const APP_ID = "chat";
const SHELL_CONFIG_CHANGED_EVENT = "freeanima:shell-config-changed";

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
  const shell = window.satelliteShell;
  if (shell?.hubWsUrl) return shell.hubWsUrl;
  const env = (import.meta as ImportMeta & { env?: { VITE_FREEANIMA_HUB_WS?: string } }).env;
  if (env?.VITE_FREEANIMA_HUB_WS?.trim()) return env.VITE_FREEANIMA_HUB_WS.trim();
  return resolveHubWsUrl("http://127.0.0.1:2658");
}

export function getSapDirectClient(): SapDirectClient {
  if (!directClient) {
    notifyConnection("connecting");
    const nativeShell =
      typeof window !== "undefined" && Boolean(window.satelliteShell?.isNativeShell);
    const remoteAuthToken = window.satelliteShell?.remoteAuth?.token;
    directClient = createSapDirectClient({
      appId: APP_ID,
      hubWsUrl: resolveHubWsUrlFromEnv(),
      instanceId: CHAT_INSTANCE_ID,
      useSharedWorker: !nativeShell,
      ...(remoteAuthToken !== undefined ? { remoteAuthToken } : {}),
      onConnectionStateChange: notifyConnection,
    });
    void directClient
      .whenReady()
      .then(() => notifyConnection("connected"))
      .catch(() => notifyConnection("disconnected"));
  }
  return directClient;
}

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

export function loadChatInstanceId(): string {
  return CHAT_INSTANCE_ID;
}

export function chatPlatform(): string {
  return formatSapPlatform(APP_ID, CHAT_INSTANCE_ID);
}

export async function whenSapClientReady(): Promise<SapClient> {
  return getSapDirectClient().whenReady();
}

/** Hub 配置变更后重建 SAP 连接（移动端 settings save） */
export function subscribeShellConfigChanges(): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = (): void => {
    void reconnectSap().catch(() => notifyConnection("disconnected"));
  };
  window.addEventListener(SHELL_CONFIG_CHANGED_EVENT, handler);
  return () => window.removeEventListener(SHELL_CONFIG_CHANGED_EVENT, handler);
}

/** 测试用：重置 module 级缓存 */
export function resetChatInstanceCacheForTests(): void {
  directClient?.stop();
  directClient = null;
  connectionListeners.clear();
  connectionState = "connecting";
}
