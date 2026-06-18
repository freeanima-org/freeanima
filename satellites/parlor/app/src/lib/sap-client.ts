import { createSapDirectClient, type SapDirectClient } from "@freeanima/sap-contract";
import { formatSapPlatform } from "@freeanima/sap-contract";

let client: SapDirectClient | null = null;

export function getSapBrowserClient(): SapDirectClient {
  if (!client) {
    client = createSapDirectClient({ appId: "parlor" });
  }
  return client;
}

export function parlorPlatform(): string {
  const instanceId = getSapBrowserClient().getInstanceId();
  if (instanceId) {
    return formatSapPlatform("parlor", instanceId);
  }
  return "sap:parlor:web";
}

/** @deprecated Use parlorPlatform() after connect */
export const PARLOR_PLATFORM = "sap:parlor:web";
