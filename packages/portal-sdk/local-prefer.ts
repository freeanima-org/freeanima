import { isHabitatRpcTransportError } from "@freeanima/shared/habitat-rpc";

/** 短窗内连续传输失败达到该次数后进入本地优先。 */
export const LOCAL_PREFER_FAILURE_THRESHOLD = 2;
/** 连续失败计入同一窗口的时长。 */
export const LOCAL_PREFER_FAILURE_WINDOW_MS = 30_000;
/** 进入本地优先后自动尝试恢复的间隔。 */
export const LOCAL_PREFER_AUTO_RETRY_MS = 30_000;

type Listener = (active: boolean) => void;

let active = false;
let consecutiveFailures = 0;
let firstFailureAt = 0;
let autoRetryTimer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<Listener>();

function emit(): void {
  for (const listener of listeners) listener(active);
}

function clearAutoRetry(): void {
  if (autoRetryTimer != null) {
    clearTimeout(autoRetryTimer);
    autoRetryTimer = null;
  }
}

function scheduleAutoRetry(): void {
  clearAutoRetry();
  autoRetryTimer = setTimeout(() => {
    autoRetryTimer = null;
    setActive(false);
  }, LOCAL_PREFER_AUTO_RETRY_MS);
}

function setActive(next: boolean): void {
  if (active === next) return;
  active = next;
  if (next) {
    scheduleAutoRetry();
  } else {
    consecutiveFailures = 0;
    firstFailureAt = 0;
    clearAutoRetry();
  }
  emit();
}

/** 读/flush 是否应跳过 Habitat、只走本地 snapshot / outbox。 */
export function isLocalPreferActive(): boolean {
  return active;
}

export function subscribeLocalPrefer(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** 用户点「尝试恢复」或探测成功后清除本地优先。 */
export function clearLocalPrefer(): void {
  setActive(false);
}

/**
 * 是否应计入弱网探测（传输超时 / 断连 / fetch 失败）。
 * 业务校验错误不得计入。
 */
export function isRecordableTransportFailure(err: unknown): boolean {
  if (isHabitatRpcTransportError(err)) return true;
  if (!(err instanceof Error)) return false;
  const msg = err.message.toLowerCase();
  return (
    msg.includes("failed to fetch") ||
    msg.includes("networkerror") ||
    msg.includes("network request failed") ||
    msg.includes("not connected")
  );
}

/** 栖息地传输失败：短窗内连续达到阈值则开启本地优先。 */
export function recordHabitatTransportFailure(): void {
  if (active) return;
  const now = Date.now();
  if (firstFailureAt === 0 || now - firstFailureAt > LOCAL_PREFER_FAILURE_WINDOW_MS) {
    firstFailureAt = now;
    consecutiveFailures = 1;
    return;
  }
  consecutiveFailures += 1;
  if (consecutiveFailures >= LOCAL_PREFER_FAILURE_THRESHOLD) {
    setActive(true);
  }
}

/** 在线 RPC 成功：清连续失败计数（不自动退出已开启的本地优先）。 */
export function recordHabitatTransportSuccess(): void {
  consecutiveFailures = 0;
  firstFailureAt = 0;
}

export function resetLocalPreferForTests(): void {
  clearAutoRetry();
  active = false;
  consecutiveFailures = 0;
  firstFailureAt = 0;
}
