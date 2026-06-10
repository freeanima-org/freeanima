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

const TRANSIENT_NAMES = new Set(["ConnectTimeoutError", "TimeoutError", "AbortError"]);

function errorText(err: unknown): string {
  if (err instanceof Error) {
    const parts = [err.name, err.message];
    if (err.cause) parts.push(errorText(err.cause));
    return parts.join(" ");
  }
  return String(err);
}

/** Whether retryable transient network error (proxy jitter, handshake timeout, fetch failure, etc.) */
export function isTransientNetworkError(err: unknown): boolean {
  if (!err) return false;
  if (err instanceof Error && TRANSIENT_NAMES.has(err.name)) return true;
  const text = errorText(err);
  return TRANSIENT_PATTERNS.some((re) => re.test(text));
}

/** Whether engine/LLM stream error (not pure network) */
export function isEngineStreamError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message;
  return /LLM call failed/i.test(msg) || /engine error/i.test(msg);
}

const NETWORK_USER_HINT = "⚠️ Network temporarily unavailable; try again later";
const ENGINE_USER_HINT = "⚠️ Engine error; try again later";

/** Error hint for platform adapters to show partners */
export function networkErrorUserHint(err: unknown): string {
  if (isEngineStreamError(err)) return ENGINE_USER_HINT;
  if (isTransientNetworkError(err)) return NETWORK_USER_HINT;
  return ENGINE_USER_HINT;
}
