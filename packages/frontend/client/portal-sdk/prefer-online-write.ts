import { isHabitatFetchAvailable, isNetworkOnline } from "./habitat-fetch-gate.ts";
import {
  isRecordableTransportFailure,
  recordHabitatTransportFailure,
  recordHabitatTransportSuccess,
} from "./local-prefer.ts";

/**
 * 在线写失败后是否应回退 outbox（仅网络/传输类）。
 * 业务校验等错误应直接抛给 UI，避免把必然失败的 op 塞进队列。
 */
export function isRetriableOfflineWriteError(err: unknown): boolean {
  if (isRecordableTransportFailure(err)) return true;
  return !isNetworkOnline();
}

/**
 * Habitat 可用时优先走 online；仅网络/传输失败时回退 offline。
 * 业务错误原样抛出。Habitat 不可用时直接 offline。
 */
export async function preferOnlineWrite<T>(
  online: () => Promise<T>,
  offline: () => Promise<T>,
): Promise<T> {
  if (!isHabitatFetchAvailable()) {
    return offline();
  }
  try {
    const result = await online();
    recordHabitatTransportSuccess();
    return result;
  } catch (err) {
    if (isRetriableOfflineWriteError(err)) {
      recordHabitatTransportFailure();
      return offline();
    }
    throw err;
  }
}
