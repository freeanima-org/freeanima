import { formatSapPlatform } from "@freeanima/sap-contract";

const APP_ID = "pair-programming";

let cachedInstanceId: string | null = null;

export async function loadPairInstanceId(): Promise<string | null> {
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

export async function pairPlatform(): Promise<string> {
  const instanceId = await loadPairInstanceId();
  if (instanceId) return formatSapPlatform(APP_ID, instanceId);
  return "sap:pairprogramming:web";
}

/** @deprecated Use pairPlatform() after sidecar connect */
export const STUDIO_PAIR_PLATFORM = "sap:pairprogramming:web";
