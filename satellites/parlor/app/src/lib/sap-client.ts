import { formatSapPlatform, type SapConnectionState } from "@freeanima/sap-contract";
import { createSapRelayBrowserClient, type SapRelayBrowserClient } from "@freeanima/sap-contract";

const APP_ID = "parlor";

let relayClient: SapRelayBrowserClient | null = null;
let cachedInstanceId: string | null = null;
const connectionListeners = new Set<(state: SapConnectionState) => void>();

function notifyConnection(state: SapConnectionState): void {
  for (const listener of connectionListeners) {
    listener(state);
  }
}

export function getSapRelayClient(): SapRelayBrowserClient {
  if (!relayClient) {
    relayClient = createSapRelayBrowserClient({
      onConnectionChange: notifyConnection,
    });
  }
  return relayClient;
}

export function getSapConnectionState(): SapConnectionState {
  return getSapRelayClient().getConnectionState();
}

export function subscribeSapConnection(listener: (state: SapConnectionState) => void): () => void {
  connectionListeners.add(listener);
  listener(getSapConnectionState());
  return () => {
    connectionListeners.delete(listener);
  };
}

export async function reconnectSap(): Promise<void> {
  await getSapRelayClient().reconnect();
}

export async function loadParlorInstanceId(): Promise<string | null> {
  if (cachedInstanceId) return cachedInstanceId;
  try {
    const res = await fetch("/config.json");
    if (!res.ok) return null;
    const raw = (await res.json()) as { instance_id?: string };
    cachedInstanceId = raw.instance_id?.trim() || null;
    return cachedInstanceId;
  } catch {
    return null;
  }
}

export async function parlorPlatform(): Promise<string> {
  const instanceId = await loadParlorInstanceId();
  if (!instanceId) {
    throw new Error("Parlor instance_id is required in config.json");
  }
  return formatSapPlatform(APP_ID, instanceId);
}

/** 测试用：重置 module 级缓存 */
export function resetParlorInstanceCacheForTests(): void {
  cachedInstanceId = null;
  relayClient?.stop();
  relayClient = null;
  connectionListeners.clear();
}
