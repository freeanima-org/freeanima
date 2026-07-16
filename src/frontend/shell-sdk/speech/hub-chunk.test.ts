import { describe, expect, it } from "bun:test";

import {
  FIRST_HUB_TTS_CHUNK_MAX,
  LATER_HUB_TTS_CHUNK_MAX,
  LATER_HUB_TTS_CHUNK_MIN,
  MIN_HUB_TTS_SPLIT_LEN,
  SECOND_HUB_TTS_CHUNK_MAX,
  SECOND_HUB_TTS_CHUNK_MIN,
} from "./constants.ts";
import { splitTextForHubSpeech } from "./hub-adapter.ts";

describe("splitTextForHubSpeech", () => {
  it("不超过 MIN_HUB_TTS_SPLIT_LEN 时不分段", () => {
    const text = "甲".repeat(MIN_HUB_TTS_SPLIT_LEN);
    expect(splitTextForHubSpeech(text)).toEqual([text]);
  });

  it("略超 20 字的短句也不强制切开", () => {
    const text = `${"甲".repeat(21)}。${"乙".repeat(30)}`;
    expect(text.length).toBeGreaterThan(20);
    expect(text.length).toBeLessThanOrEqual(MIN_HUB_TTS_SPLIT_LEN);
    expect(splitTextForHubSpeech(text)).toEqual([text]);
  });

  it("超过首段上限才分段，首段不超过 200", () => {
    const long = `${"甲".repeat(80)}。${"乙".repeat(300)}。${"丙".repeat(600)}。`;
    const chunks = splitTextForHubSpeech(long);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0]?.length ?? 0).toBeLessThanOrEqual(FIRST_HUB_TTS_CHUNK_MAX);
    expect(chunks[0]).toBe(`${"甲".repeat(80)}。`);
  });

  it("无标点且不超过首段上限时保持单段", () => {
    const text = "甲".repeat(50);
    expect(splitTextForHubSpeech(text)).toEqual([text]);
  });

  it("无标点超首段上限时按上限切开", () => {
    const text = "甲".repeat(FIRST_HUB_TTS_CHUNK_MAX + 50);
    const chunks = splitTextForHubSpeech(text);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0]?.length ?? 0).toBe(FIRST_HUB_TTS_CHUNK_MAX);
    expect(chunks.join("")).toBe(text);
  });

  it("第二段落在 100-200 字范围（余量不足时允许更短）", () => {
    const first = `${"甲".repeat(80)}。`;
    const second = `${"乙".repeat(150)}。`;
    const third = `${"丙".repeat(80)}。`;
    const chunks = splitTextForHubSpeech(first + second + third);
    expect(chunks[0]).toBe(first);
    expect(chunks[1]?.length ?? 0).toBeGreaterThanOrEqual(SECOND_HUB_TTS_CHUNK_MIN);
    expect(chunks[1]?.length ?? 0).toBeLessThanOrEqual(SECOND_HUB_TTS_CHUNK_MAX);
  });

  it("第三段起按 500-1000 字聚合", () => {
    const parts = [
      `${"甲".repeat(60)}。`,
      `${"乙".repeat(150)}。`,
      `${"丙".repeat(600)}。`,
      `${"丁".repeat(600)}。`,
    ];
    const text = parts.join("");
    const chunks = splitTextForHubSpeech(text);
    expect(chunks.length).toBeGreaterThanOrEqual(4);
    const later = chunks[2] ?? "";
    expect(later.length).toBeGreaterThanOrEqual(LATER_HUB_TTS_CHUNK_MIN);
    expect(later.length).toBeLessThanOrEqual(LATER_HUB_TTS_CHUNK_MAX);
  });
});
