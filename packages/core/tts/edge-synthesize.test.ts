import { describe, expect, it } from "bun:test";

import {
  collectCommunicateAudio,
  mapProsodyToEdgeStrings,
  validateEdgeTtsText,
  MAX_EDGE_TTS_TEXT_LENGTH,
} from "./edge-synthesize.ts";
import { resolveEdgeVoiceName } from "./edge-voices.ts";

describe("mapProsodyToEdgeStrings", () => {
  it("maps neutral prosody to Edge defaults", () => {
    expect(mapProsodyToEdgeStrings(1, 1, 1)).toEqual({
      rate: "+0%",
      pitch: "+0Hz",
      volume: "+0%",
    });
  });

  it("maps faster rate and lower volume", () => {
    expect(mapProsodyToEdgeStrings(1.5, 0.5, 0.5)).toEqual({
      rate: "+50%",
      pitch: "-25Hz",
      volume: "-50%",
    });
  });
});

describe("resolveEdgeVoiceName", () => {
  it("uses explicit voice when set", () => {
    expect(resolveEdgeVoiceName("en-US-GuyNeural", "zh-CN", "zh-CN")).toBe("en-US-GuyNeural");
  });

  it("defaults by language", () => {
    expect(resolveEdgeVoiceName(null, "zh-CN", "en-US")).toBe("zh-CN-XiaoxiaoNeural");
    expect(resolveEdgeVoiceName(null, null, "en-US")).toBe("en-US-JennyNeural");
  });
});

describe("validateEdgeTtsText", () => {
  it("rejects empty and overlong text", () => {
    expect(() => validateEdgeTtsText("   ")).toThrow("不能为空");
    expect(() => validateEdgeTtsText("a".repeat(MAX_EDGE_TTS_TEXT_LENGTH + 1))).toThrow("过长");
  });
});

describe("collectCommunicateAudio", () => {
  it("拼接 mock stream 的 audio chunk", async () => {
    const communicate = {
      async *stream() {
        yield { type: "audio" as const, data: Buffer.from([1, 2]) };
        yield { type: "WordBoundary" as const };
        yield { type: "audio" as const, data: Buffer.from([3]) };
      },
    };
    const buf = await collectCommunicateAudio(communicate as never);
    expect([...buf]).toEqual([1, 2, 3]);
  });

  it("无 audio chunk 时抛错", async () => {
    const communicate = {
      async *stream() {
        yield { type: "WordBoundary" as const };
      },
    };
    await expect(collectCommunicateAudio(communicate as never)).rejects.toThrow("未返回音频");
  });
});
