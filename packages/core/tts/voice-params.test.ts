import { describe, expect, it } from "bun:test";

import {
  mapVoiceProsodyToAlibabaTts,
  mapVoiceProsodyToEdge,
  mapVoiceProsodyToOpenAiSpeech,
  mergeVoiceProsodyParams,
  readVoiceProsodyParams,
} from "./voice-params.ts";

describe("VoiceProsodyParams", () => {
  it("reads and merges neutral params", () => {
    const base = readVoiceProsodyParams({ voice: "a", rate: 1.2 });
    const merged = mergeVoiceProsodyParams(base, { pitch: 1.1, rate: 0.9 });
    expect(merged.voice).toBe("a");
    expect(merged.rate).toBe(0.9);
    expect(merged.pitch).toBe(1.1);
  });

  it("maps to OpenAI speed clamp", () => {
    const mapped = mapVoiceProsodyToOpenAiSpeech({ rate: 3, voice: "nova", format: "mp3" });
    expect(mapped.speed).toBe(3);
    expect(mapped.voice).toBe("nova");
    expect(mapped.response_format).toBe("mp3");
  });

  it("maps to Alibaba volume 0–100", () => {
    const mapped = mapVoiceProsodyToAlibabaTts({ volume: 0.5, rate: 1, pitch: 1 });
    expect(mapped.volume).toBe(50);
    expect(mapped.rate).toBe(1);
  });

  it("maps to edge prosody strings", () => {
    const mapped = mapVoiceProsodyToEdge({ rate: 1.2, pitch: 1, volume: 1 });
    expect(mapped.edgeStrings.rate).toMatch(/^\+/);
  });
});
