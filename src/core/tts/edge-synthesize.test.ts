import { describe, expect, it } from "bun:test";

import { mapProsodyToEdgeStrings } from "./edge-synthesize.ts";
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

describe("synthesizeEdgeTts validation", () => {
  it("rejects empty and overlong text", async () => {
    const { synthesizeEdgeTts, MAX_EDGE_TTS_TEXT_LENGTH } = await import("./edge-synthesize.ts");
    await expect(synthesizeEdgeTts({ text: "   " })).rejects.toThrow("不能为空");
    await expect(
      synthesizeEdgeTts({ text: "a".repeat(MAX_EDGE_TTS_TEXT_LENGTH + 1) }),
    ).rejects.toThrow("过长");
  });
});
