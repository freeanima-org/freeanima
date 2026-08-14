import {
  DEFAULT_EMBEDDING_QUERY_TIMEOUT_MS,
  getActiveRuntimeConfig,
  getEmbeddingQueryTimeoutMs,
} from "@freeanima/habitat/core/config";

import { logPgComponent } from "../log.ts";

import { getEmbedTextFn } from "./runtime.ts";

const log = logPgComponent("embedding");

/** Unit-test override; null = use active config / default */
let queryTimeoutMsForTest: number | null = null;

/** Unit test isolation for query embed budget */
export function setQueryTimeoutMsForTest(ms: number | null): void {
  queryTimeoutMsForTest = ms;
}

function resolveQueryTimeoutMs(): number {
  if (queryTimeoutMsForTest != null && queryTimeoutMsForTest > 0) {
    return queryTimeoutMsForTest;
  }
  try {
    return getEmbeddingQueryTimeoutMs(getActiveRuntimeConfig().data);
  } catch {
    return DEFAULT_EMBEDDING_QUERY_TIMEOUT_MS;
  }
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error("query embedding timeout"));
    }, timeoutMs);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer != null) clearTimeout(timer);
  }
}

/** Convert user query text to embedding; returns null when not configured, timed out, or upstream fails */
export async function embedQueryText(text: string): Promise<number[] | null> {
  const embed = getEmbedTextFn();
  if (!embed) return null;
  const trimmed = text.trim();
  if (!trimmed) return null;
  const timeoutMs = resolveQueryTimeoutMs();
  const embedPromise = embed(trimmed);
  // Timed-out requests may still settle; avoid unhandled rejection noise
  void embedPromise.catch(() => {});
  try {
    return await withTimeout(embedPromise, timeoutMs);
  } catch (err) {
    const timedOut = err instanceof Error && err.message === "query embedding timeout";
    log.warn("query embedding failed; falling back to non-vector search", {
      error: String(err),
      timeout: timedOut,
      timeout_ms: timeoutMs,
    });
    return null;
  }
}
