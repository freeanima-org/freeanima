const TRANSIENT_PATTERNS = [
  /connect\s*timeout/i,
  /connection\s*timed?\s*out/i,
  /opening handshake has timed out/i,
  /fetch failed/i,
  /econnreset/i,
  /econnrefused/i,
  /enotfound/i,
  /enetunreach/i,
  /etimedout/i,
  /socket hang up/i,
  /network\s*error/i,
  /aborted/i,
  /abort/i,
];

const TRANSIENT_NAMES = new Set([
  "ConnectTimeoutError",
  "TimeoutError",
  "AbortError",
]);

function errorText(err: unknown): string {
  if (err instanceof Error) {
    const parts = [err.name, err.message];
    if (err.cause) parts.push(errorText(err.cause));
    return parts.join(" ");
  }
  return String(err);
}

/** 是否为可重试的瞬态网络错误（代理抖动、握手超时、fetch 失败等） */
export function isTransientNetworkError(err: unknown): boolean {
  if (!err) return false;
  if (err instanceof Error && TRANSIENT_NAMES.has(err.name)) return true;
  const text = errorText(err);
  return TRANSIENT_PATTERNS.some((re) => re.test(text));
}

/** 是否为引擎/LLM 流错误（非纯网络） */
export function isEngineStreamError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message;
  return /LLM\s*调用失败/i.test(msg) || /engine error/i.test(msg);
}

const NETWORK_USER_HINT = "⚠️ 网络暂时不可用，请稍后再试";
const ENGINE_USER_HINT = "⚠️ 引擎出错，请稍后再试";

/** 供平台适配器向伙伴展示的错误提示 */
export function networkErrorUserHint(err: unknown): string {
  if (isEngineStreamError(err)) return ENGINE_USER_HINT;
  if (isTransientNetworkError(err)) return NETWORK_USER_HINT;
  return ENGINE_USER_HINT;
}
