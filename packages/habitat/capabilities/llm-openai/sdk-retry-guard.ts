/**
 * OpenAI / Anthropic SDK 会按 Retry-After 原样 sleep 再重试 429。
 * 阿里云 Token Plan 配额耗尽会回 retry-after≈数天，请求表现为死等超时。
 * 本层在 fetch 上标 x-should-retry: false，让 SDK 立刻抛出。
 */

import { LlmTimeoutError, isLlmTimeoutError } from "./request-timeouts.ts";
export const MAX_PROVIDER_RETRY_AFTER_MS = 10_000;

export function isQuotaExhaustedText(text: string): boolean {
  const lower = text.toLowerCase();
  return (
    lower.includes("insufficient_quota") ||
    lower.includes("allocated quota exceeded") ||
    lower.includes("quota has been exhausted") ||
    lower.includes("quota exhausted")
  );
}

export function parseRetryAfterHeaderMs(headers: Headers): number | null {
  const retryAfterMs = headers.get("retry-after-ms");
  if (retryAfterMs) {
    const n = Number.parseFloat(retryAfterMs);
    if (Number.isFinite(n) && n >= 0) return n;
  }
  const retryAfter = headers.get("retry-after");
  if (!retryAfter) return null;
  const seconds = Number.parseFloat(retryAfter);
  if (Number.isFinite(seconds) && !retryAfter.trim().includes(" ")) {
    return seconds * 1000;
  }
  const at = Date.parse(retryAfter);
  if (!Number.isNaN(at)) return at - Date.now();
  return null;
}

function shouldFail429Immediately(headers: Headers, body: string): boolean {
  if (isQuotaExhaustedText(body)) return true;
  const waitMs = parseRetryAfterHeaderMs(headers);
  return waitMs != null && waitMs > MAX_PROVIDER_RETRY_AFTER_MS;
}

export type SdkFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

/**
 * 直到 HTTP 响应头：超时则 abort，reason 为 LlmTimeoutError("connect")。
 * fetch() 在 headers 到达时即 resolve，body 慢读不会再触发本计时。
 */
export function wrapConnectTimeout(inner: SdkFetch, connectMs: number): SdkFetch {
  return async (input, init) => {
    const ac = new AbortController();
    const timer = setTimeout(() => {
      ac.abort(new LlmTimeoutError("connect", connectMs));
    }, connectMs);
    const signal = init?.signal ? AbortSignal.any([init.signal, ac.signal]) : ac.signal;
    try {
      return await inner(input, { ...init, signal });
    } catch (err) {
      if (ac.signal.aborted && isLlmTimeoutError(ac.signal.reason)) {
        const abort = new Error("Aborted", { cause: ac.signal.reason });
        abort.name = "AbortError";
        throw abort;
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  };
}

export function wrapSdkFetch(inner: SdkFetch): SdkFetch {
  return async (input, init) => {
    const response = await inner(input, init);
    if (response.status !== 429) return response;
    const body = await response.text();
    if (!shouldFail429Immediately(response.headers, body)) {
      return new Response(body, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      });
    }
    const headers = new Headers(response.headers);
    headers.set("x-should-retry", "false");
    return new Response(body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  };
}

/** 配额 429 护栏 + 连接/响应头超时（OpenAI / Anthropic SDK 共用） */
export function createSdkFetch(connectMs: number): SdkFetch {
  return wrapSdkFetch(wrapConnectTimeout(fetch, connectMs));
}
