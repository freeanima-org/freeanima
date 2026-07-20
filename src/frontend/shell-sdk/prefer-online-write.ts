import { isHubRpcTransportError } from "@freeanima/shared/hub-rpc";

import { isHubFetchAvailable, isNetworkOnline } from "./hub-fetch-gate.ts";

/**
 * 在线写失败后是否应回退 outbox（仅网络/传输类）。
 * 业务校验等错误应直接抛给 UI，避免把必然失败的 op 塞进队列。
 */
export function isRetriableOfflineWriteError(err: unknown): boolean {
  if (isHubRpcTransportError(err)) return true;
  if (!isNetworkOnline()) return true;
  if (!(err instanceof Error)) return false;
  const msg = err.message.toLowerCase();
  return (
    msg.includes("failed to fetch") ||
    msg.includes("networkerror") ||
    msg.includes("network request failed") ||
    msg.includes("hub not connected") ||
    msg.includes("not connected")
  );
}

/**
 * Hub 可用时优先走 online；仅网络/传输失败时回退 offline。
 * 业务错误原样抛出。Hub 不可用时直接 offline。
 */
export async function preferOnlineWrite<T>(
  online: () => Promise<T>,
  offline: () => Promise<T>,
): Promise<T> {
  if (!isHubFetchAvailable()) {
    return offline();
  }
  try {
    return await online();
  } catch (err) {
    if (isRetriableOfflineWriteError(err)) {
      return offline();
    }
    throw err;
  }
}
