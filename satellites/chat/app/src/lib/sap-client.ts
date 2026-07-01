/// <reference lib="dom" />
import {
  CHAT_INSTANCE_ID,
  formatSapPlatform,
  resolveHubRpcWsUrl,
  getBundledSapStreamClient,
  resetBundledSapStreamClientForTests,
  subscribeShellConfigChanges,
  whenBundledSapClientReady,
  type SapClient,
  type SapConnectionState,
} from "@freeanima/sap-contract";

const APP_ID = "chat";

let connectionState: SapConnectionState = "connecting";
const connectionListeners = new Set<(state: SapConnectionState) => void>();

function notifyConnection(state: SapConnectionState): void {
  connectionState = state;
  for (const listener of connectionListeners) {
    listener(state);
  }
}

function resolveHubRpcWsUrlFromEnv(): string {
  const shell = window.satelliteShell;
  if (shell?.hubWsUrl) return shell.hubWsUrl;
  const env = (import.meta as ImportMeta & { env?: { VITE_FREEANIMA_HUB_WS?: string } }).env;
  if (env?.VITE_FREEANIMA_HUB_WS?.trim()) return env.VITE_FREEANIMA_HUB_WS.trim();
  return resolveHubRpcWsUrl("http://127.0.0.1:2658");
}

function getClient() {
  return getBundledSapStreamClient({
    hubRpcWsUrl: resolveHubRpcWsUrlFromEnv(),
    onConnectionStateChange: notifyConnection,
  });
}

export function getSapDirectClient() {
  return getClient();
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
  getClient().stop();
  resetBundledSapStreamClientForTests();
  notifyConnection("connecting");
  await getClient().whenReady();
  notifyConnection("connected");
}

export function loadChatInstanceId(): string {
  return CHAT_INSTANCE_ID;
}

export function chatPlatform(): string {
  return formatSapPlatform(APP_ID, CHAT_INSTANCE_ID);
}

export async function whenSapClientReady(): Promise<SapClient> {
  return whenBundledSapClientReady();
}

export { subscribeShellConfigChanges };

export function resetChatInstanceCacheForTests(): void {
  resetBundledSapStreamClientForTests();
  connectionListeners.clear();
  connectionState = "connecting";
}
