import { afterEach, describe, expect, it, vi } from "bun:test";

import { coerceString } from "@freeanima/shared/coerce-string";
import {
  WEIXIN_TEXT_CHUNK_LIMIT,
  _resetWeixinSessionPauseForTest,
  chunkWeixinText,
  isWeixinSessionPaused,
  pauseWeixinSession,
  sendTextChunked,
} from "@freeanima/host/capabilities/connectors/gateway";

describe("chunkWeixinText", () => {
  it("empty string returns empty array", () => {
    expect(chunkWeixinText("")).toEqual([]);
    expect(chunkWeixinText("   ")).toEqual([]);
  });

  it("short text not split", () => {
    expect(chunkWeixinText("hello")).toEqual(["hello"]);
  });

  it("splits overlong text by limit", () => {
    const body = "a".repeat(2500);
    const chunks = chunkWeixinText(body, WEIXIN_TEXT_CHUNK_LIMIT);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.join("")).toBe(body);
    for (const c of chunks) {
      expect(c.length).toBeLessThanOrEqual(WEIXIN_TEXT_CHUNK_LIMIT);
    }
  });

  it("prefers split at double newline", () => {
    const para1 = "a".repeat(100);
    const para2 = "b".repeat(100);
    const text = `${para1}\n\n${para2}`;
    const chunks = chunkWeixinText(text, 120);
    expect(chunks.length).toBe(2);
    expect(chunks[0]).toBe(para1);
    expect(chunks[1]).toBe(para2);
  });
});

describe("weixin conversation pause", () => {
  afterEach(() => {
    _resetWeixinSessionPauseForTest();
  });

  it("isWeixinSessionPaused true after pause", () => {
    pauseWeixinSession("acct-1");
    expect(isWeixinSessionPaused("acct-1")).toBe(true);
    expect(isWeixinSessionPaused("acct-2")).toBe(false);
  });
});

describe("sendTextChunked", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("POST includes X-WECHAT-UIN and base_info.bot_agent", async () => {
    const seenHeaders: Record<string, string>[] = [];
    const seenBodies: string[] = [];

    globalThis.fetch = vi.fn(async (_url: string, init?: RequestInit) => {
      const hdrs = init?.headers as Record<string, string>;
      seenHeaders.push(hdrs);
      seenBodies.push(coerceString(init?.body ?? ""));
      return new Response(JSON.stringify({ ret: 0, errcode: 0 }), { status: 200 });
    }) as unknown as typeof fetch;

    await sendTextChunked(
      "https://ilinkai.weixin.qq.com",
      "test-token",
      "peer@im.wechat",
      "hello",
      "anima-test",
      "ctx-token",
    );

    expect(seenHeaders.length).toBe(1);
    expect(seenHeaders[0]!["X-WECHAT-UIN"]).toBeTruthy();
    expect(seenHeaders[0]!["iLink-App-Id"]).toBe("bot");
    expect(seenHeaders[0]!["AuthorizationType"]).toBe("ilink_bot_token");

    const body = JSON.parse(seenBodies[0]!) as {
      base_info: { channel_version: string; bot_agent: string };
      msg: { context_token: string; item_list: { text_item: { text: string } }[] };
    };
    expect(body.base_info.bot_agent).toMatch(/^freeanima\//);
    expect(body.base_info.channel_version).toBeTruthy();
    expect(body.msg.context_token).toBe("ctx-token");
    expect(body.msg.item_list[0]!.text_item.text).toBe("hello");
  });

  it("long text split into multiple POSTs", async () => {
    let postCount = 0;
    globalThis.fetch = vi.fn(async () => {
      postCount += 1;
      return new Response(JSON.stringify({ ret: 0, errcode: 0 }), { status: 200 });
    }) as unknown as typeof fetch;

    const long = "x".repeat(WEIXIN_TEXT_CHUNK_LIMIT + 100);
    const result = await sendTextChunked(
      "https://ilinkai.weixin.qq.com",
      "test-token",
      "peer@im.wechat",
      long,
      "anima-test",
    );

    expect(result.chunks).toBe(2);
    expect(postCount).toBe(2);
  });
});
