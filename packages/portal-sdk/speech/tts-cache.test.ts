import { afterEach, describe, expect, it } from "bun:test";

import {
  TTS_CACHE_MAX_BYTES,
  TTS_CACHE_MAX_ENTRIES,
  TtsAudioCache,
  buildTtsCacheKey,
  serializeTtsCacheParams,
  setTtsAudioCacheForTests,
} from "./tts-cache.ts";

afterEach(() => {
  setTtsAudioCacheForTests(null);
});

describe("buildTtsCacheKey", () => {
  it("相同参数生成相同 key", async () => {
    const params = {
      text: "你好世界",
      lang: "zh-CN",
      voice: "zh-CN-XiaoxiaoNeural",
      appLocale: "zh-CN",
      rate: 1,
      pitch: 1,
      volume: 1,
    };
    const a = await buildTtsCacheKey(params);
    const b = await buildTtsCacheKey(params);
    expect(a).toBe(b);
  });

  it("空白归一化后 key 一致", async () => {
    const a = await buildTtsCacheKey({
      text: "你好  世界",
      appLocale: "zh-CN",
    });
    const b = await buildTtsCacheKey({
      text: "你好 世界",
      appLocale: "zh-CN",
    });
    expect(a).toBe(b);
  });
});

describe("serializeTtsCacheParams", () => {
  it("包含默认韵律参数", () => {
    const payload = serializeTtsCacheParams({ text: "test", appLocale: "en-US" });
    expect(payload).toContain('"rate":1');
    expect(payload).toContain('"pitch":1');
    expect(payload).toContain('"volume":1');
  });
});

describe("TtsAudioCache", () => {
  it("LRU 淘汰最久未使用条目", () => {
    const cache = new TtsAudioCache();
    const buf = new Uint8Array(8).buffer;

    for (let i = 0; i < TTS_CACHE_MAX_ENTRIES; i++) {
      cache.set(`k${i}`, buf);
    }
    cache.get("k0");
    cache.set("new", buf);

    expect(cache.get("k0")).not.toBeNull();
    expect(cache.get("k1")).toBeNull();
    expect(cache.get("new")).not.toBeNull();
  });

  it("超过条目上限时淘汰", () => {
    const cache = new TtsAudioCache();
    const buf = new Uint8Array(8).buffer;

    for (let i = 0; i < TTS_CACHE_MAX_ENTRIES + 2; i++) {
      cache.set(`k${i}`, buf);
    }

    expect(cache.size).toBeLessThanOrEqual(TTS_CACHE_MAX_ENTRIES);
    expect(cache.get("k0")).toBeNull();
    expect(cache.get(`k${TTS_CACHE_MAX_ENTRIES + 1}`)).not.toBeNull();
  });

  it("超过字节上限时淘汰", () => {
    const cache = new TtsAudioCache();
    const large = new Uint8Array(TTS_CACHE_MAX_BYTES / 2 + 1).buffer;

    cache.set("big1", large);
    cache.set("big2", large);

    expect(cache.bytes).toBeLessThanOrEqual(TTS_CACHE_MAX_BYTES);
    expect(cache.size).toBe(1);
  });

  it("clear 重置缓存", () => {
    const cache = new TtsAudioCache();
    cache.set("x", new Uint8Array(4).buffer);
    cache.clear();
    expect(cache.size).toBe(0);
    expect(cache.bytes).toBe(0);
    expect(cache.get("x")).toBeNull();
  });
});
