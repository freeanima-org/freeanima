import { describe, expect, it } from "bun:test";

import { getResolvedSpeechConfig } from "./tts-helpers.ts";

describe("getResolvedSpeechConfig", () => {
  it("uses defaults when tts section is missing", () => {
    const resolved = getResolvedSpeechConfig({});
    expect(resolved.enabled).toBe(true);
    expect(resolved.provider).toBe("edge-tts");
    expect(resolved.lang).toBeNull();
    expect(resolved.rate).toBe(1);
    expect(resolved.pitch).toBe(1);
    expect(resolved.volume).toBe(1);
    expect(resolved.preferLocal).toBe(true);
    expect(resolved.previewText).toContain("逸灵风");
  });

  it("respects explicit tts fields", () => {
    const resolved = getResolvedSpeechConfig({
      tts: {
        enabled: false,
        provider: "web-speech",
        lang: "en-US",
        voice_name: "Samantha",
        prefer_local: false,
        rate: 1.2,
        pitch: 0.8,
        volume: 0.5,
        preview_text: "Hello",
      },
    } as never);
    expect(resolved.enabled).toBe(false);
    expect(resolved.provider).toBe("web-speech");
    expect(resolved.lang).toBe("en-US");
    expect(resolved.voiceName).toBe("Samantha");
    expect(resolved.preferLocal).toBe(false);
    expect(resolved.rate).toBe(1.2);
    expect(resolved.pitch).toBe(0.8);
    expect(resolved.volume).toBe(0.5);
    expect(resolved.previewText).toBe("Hello");
  });
});
