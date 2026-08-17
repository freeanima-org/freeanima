import { describe, expect, it } from "bun:test";

import { alibabaAudioWsUrl } from "@freeanima/habitat/capabilities/llm-openai/audio-alibaba";
import {
  alibabaBuiltinVoiceGenerateEntries,
  isAlibabaRealtimeVoiceModel,
} from "@freeanima/habitat/core/llm/voice-generate-models";

describe("alibaba audio helpers", () => {
  it("derives ws url from openai-compatible root", () => {
    expect(
      alibabaAudioWsUrl("https://token-plan.cn-beijing.maas.aliyuncs.com/compatible-mode/v1"),
    ).toBe("wss://token-plan.cn-beijing.maas.aliyuncs.com/api-ws/v1/inference");
  });

  it("builtin voice entries exclude ASR", () => {
    const rows = alibabaBuiltinVoiceGenerateEntries();
    expect(rows.some((r) => r.model.includes("tts"))).toBe(true);
    expect(rows.some((r) => r.model.includes("asr"))).toBe(false);
  });

  it("detects realtime model id", () => {
    expect(isAlibabaRealtimeVoiceModel("qwen-audio-3.0-realtime-plus")).toBe(true);
    expect(isAlibabaRealtimeVoiceModel("qwen-audio-3.0-tts-plus")).toBe(false);
  });
});
