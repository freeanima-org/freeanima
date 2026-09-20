import { describe, expect, it } from "bun:test";
import {
  AUDIO_PROTOCOL_ALIBABA_AUDIO,
  AUDIO_PROTOCOL_EDGE_TTS,
  AUDIO_PROTOCOL_OPENAI_AUDIO,
} from "@freeanima/core/config/schemas/llm-config";
import {
  defaultVoiceIdForProtocol,
  listVoiceCatalog,
  voiceProtocolSeparatesModelAndVoice,
} from "./voice-catalog.ts";

describe("listVoiceCatalog", () => {
  it("edge returns neural voice ids", () => {
    const rows = listVoiceCatalog({ protocol: AUDIO_PROTOCOL_EDGE_TTS });
    expect(rows.some((r) => r.id === "zh-CN-XiaoxiaoNeural")).toBe(true);
  });

  it("openai includes alloy", () => {
    const rows = listVoiceCatalog({ protocol: AUDIO_PROTOCOL_OPENAI_AUDIO });
    expect(rows.map((r) => r.id)).toContain("alloy");
  });

  it("alibaba filters by qwen-audio model", () => {
    const rows = listVoiceCatalog({
      protocol: AUDIO_PROTOCOL_ALIBABA_AUDIO,
      model: "qwen-audio-3.0-tts-plus",
    });
    expect(rows.map((r) => r.id)).toContain("longanlingxin");
    expect(rows.map((r) => r.id)).not.toContain("longxiaochun_v2");
  });

  it("alibaba unknown model yields empty (no wrong-voice fallback)", () => {
    const rows = listVoiceCatalog({
      protocol: AUDIO_PROTOCOL_ALIBABA_AUDIO,
      model: "not-a-real-tts-model",
    });
    expect(rows).toEqual([]);
    expect(
      defaultVoiceIdForProtocol(AUDIO_PROTOCOL_ALIBABA_AUDIO, "not-a-real-tts-model"),
    ).toBeUndefined();
  });

  it("defaultVoiceIdForProtocol returns first catalog id", () => {
    expect(defaultVoiceIdForProtocol(AUDIO_PROTOCOL_ALIBABA_AUDIO, "qwen-audio-3.0-tts-plus")).toBe(
      "longanlingxin",
    );
    expect(defaultVoiceIdForProtocol(AUDIO_PROTOCOL_OPENAI_AUDIO)).toBe("alloy");
  });

  it("voiceProtocolSeparatesModelAndVoice", () => {
    expect(voiceProtocolSeparatesModelAndVoice(AUDIO_PROTOCOL_EDGE_TTS)).toBe(false);
    expect(voiceProtocolSeparatesModelAndVoice(AUDIO_PROTOCOL_OPENAI_AUDIO)).toBe(true);
    expect(voiceProtocolSeparatesModelAndVoice(AUDIO_PROTOCOL_ALIBABA_AUDIO)).toBe(true);
  });
});
