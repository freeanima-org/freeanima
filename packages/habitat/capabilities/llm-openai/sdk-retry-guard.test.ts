import { describe, expect, it } from "bun:test";
import {
  MAX_PROVIDER_RETRY_AFTER_MS,
  isQuotaExhaustedText,
  parseRetryAfterHeaderMs,
  wrapSdkFetch,
} from "./sdk-retry-guard.ts";

describe("isQuotaExhaustedText", () => {
  it("detects token-plan weekly quota body", () => {
    expect(
      isQuotaExhaustedText(
        '{"error":{"code":"insufficient_quota","message":"Your token-plan 1-week quota has been exhausted."}}',
      ),
    ).toBe(true);
  });

  it("detects allocated quota exceeded", () => {
    expect(
      isQuotaExhaustedText("429 Allocated quota exceeded, please increase your quota limit."),
    ).toBe(true);
  });

  it("ignores generic rate limit", () => {
    expect(isQuotaExhaustedText("429 Too Many Requests")).toBe(false);
  });
});

describe("parseRetryAfterHeaderMs", () => {
  it("reads retry-after seconds", () => {
    expect(parseRetryAfterHeaderMs(new Headers({ "retry-after": "390623" }))).toBe(390623_000);
  });

  it("prefers retry-after-ms", () => {
    expect(
      parseRetryAfterHeaderMs(new Headers({ "retry-after-ms": "1500", "retry-after": "2" })),
    ).toBe(1500);
  });
});

describe("wrapSdkFetch", () => {
  it("marks quota-exhausted 429 as not retryable", async () => {
    const body =
      '{"error":{"message":"Your token-plan 1-week quota has been exhausted.","code":"insufficient_quota"}}';
    const fetchImpl = wrapSdkFetch(async () => {
      return new Response(body, {
        status: 429,
        headers: { "retry-after": "390623", "content-type": "text/plain" },
      });
    });
    const res = await fetchImpl("https://example.test/v1/chat/completions");
    expect(res.status).toBe(429);
    expect(res.headers.get("x-should-retry")).toBe("false");
    expect(await res.text()).toBe(body);
  });

  it("marks oversized Retry-After as not retryable even without quota text", async () => {
    const fetchImpl = wrapSdkFetch(async () => {
      return new Response("rate", {
        status: 429,
        headers: { "retry-after": String(Math.ceil(MAX_PROVIDER_RETRY_AFTER_MS / 1000) + 1) },
      });
    });
    const res = await fetchImpl("https://example.test/v1/chat/completions");
    expect(res.headers.get("x-should-retry")).toBe("false");
  });

  it("leaves short 429 retryable for the SDK", async () => {
    const fetchImpl = wrapSdkFetch(async () => {
      return new Response("slow down", {
        status: 429,
        headers: { "retry-after": "2" },
      });
    });
    const res = await fetchImpl("https://example.test/v1/chat/completions");
    expect(res.status).toBe(429);
    expect(res.headers.get("x-should-retry")).not.toBe("false");
    expect(await res.text()).toBe("slow down");
  });

  it("does not rewrite successful responses", async () => {
    const fetchImpl = wrapSdkFetch(async () => new Response("ok", { status: 200 }));
    const res = await fetchImpl("https://example.test/v1/models");
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("ok");
  });
});
