import { formatSapPlatform } from "@freeanima/sap-contract";
import { createSapRelayBrowserClient, type SapRelayBrowserClient } from "@freeanima/sap-contract";

const APP_ID = "parlor";

let relayClient: SapRelayBrowserClient | null = null;
let cachedInstanceId: string | null = null;

export function getSapRelayClient(): SapRelayBrowserClient {
  if (!relayClient) {
    relayClient = createSapRelayBrowserClient();
  }
  return relayClient;
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
  if (instanceId) return formatSapPlatform(APP_ID, instanceId);
  return "sap:parlor:web";
}

/** @deprecated Use parlorPlatform() after sidecar connect */
export const PARLOR_PLATFORM = "sap:parlor:web";

/** 测试用：重置 module 级缓存 */
export function resetParlorInstanceCacheForTests(): void {
  cachedInstanceId = null;
}
