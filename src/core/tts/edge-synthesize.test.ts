import { describe, expect, it, mock } from "bun:test";

import { mapProsodyToEdgeStrings } from "./edge-synthesize.ts";
import { resolveEdgeVoiceName } from "./edge-voices.ts";

mock.module("edge-tts-universal", () => {
  class MockCommunicate {
    constructor(
      readonly text: string,
      readonly options: unknown,
    ) {}

    async *stream() {
      yield { type: "audio", data: Buffer.from([0xff, 0xfb, 0x90, 0x00]) };
      yield { type: "audio", data: Buffer.from([0x00, 0x00, 0x00, 0x00]) };
    }
  }

  return { Communicate: MockCommunicate };
});

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

describe("synthesizeEdgeTts validation", () => {
  it("rejects empty and overlong text", async () => {
    const { synthesizeEdgeTts, MAX_EDGE_TTS_TEXT_LENGTH } = await import("./edge-synthesize.ts");
    await expect(synthesizeEdgeTts({ text: "   " })).rejects.toThrow("不能为空");
    await expect(
      synthesizeEdgeTts({ text: "a".repeat(MAX_EDGE_TTS_TEXT_LENGTH + 1) }),
    ).rejects.toThrow("过长");
  });
});

describe("streamEdgeTtsAudio", () => {
  it("产出非空 MP3 字节流", async () => {
    const { streamEdgeTtsAudio } = await import("./edge-synthesize.ts");
    const stream = streamEdgeTtsAudio({ text: "你好" });
    const reader = stream.getReader();
    const chunks: Uint8Array[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) chunks.push(value);
    }
    const total = chunks.reduce((sum, c) => sum + c.byteLength, 0);
    expect(total).toBeGreaterThan(0);
  });

  it("空文本流直接报错", async () => {
    const { streamEdgeTtsAudio } = await import("./edge-synthesize.ts");
    const stream = streamEdgeTtsAudio({ text: "   " });
    const reader = stream.getReader();
    await expect(reader.read()).rejects.toThrow("不能为空");
  });
});
