import { describe, expect, it } from "bun:test";
import {
  LLM_FORMAT_ANTHROPIC_MESSAGES,
  LLM_FORMAT_OPENAI_COMPATIBLE,
  LLM_FORMAT_OPENAI_RESPONSES,
  LLM_PRESET_ALIBABA_TOKEN_PLAN,
  LLM_PRESET_CUSTOM,
  LLM_PRESET_DEEPSEEK,
  LLM_PRESET_OPENCODE_GO,
  llmProviderSchema,
} from "@freeanima/habitat/core/config";
import {
  effectiveProviderModalities,
  materializeConnection,
  providerConfigToSpec,
  resolveOpencodeGoFormat,
} from "./presets.ts";

describe("resolveOpencodeGoFormat", () => {
  it("routes known models", () => {
    expect(resolveOpencodeGoFormat("deepseek-v4-flash")).toBe(LLM_FORMAT_OPENAI_COMPATIBLE);
    expect(resolveOpencodeGoFormat("gpt-5.6-luna")).toBe(LLM_FORMAT_OPENAI_RESPONSES);
    expect(resolveOpencodeGoFormat("minimax-m2.7")).toBe(LLM_FORMAT_ANTHROPIC_MESSAGES);
    expect(resolveOpencodeGoFormat("qwen3.7-plus")).toBe(LLM_FORMAT_ANTHROPIC_MESSAGES);
    expect(resolveOpencodeGoFormat("opencode-go/kimi-k3")).toBe(LLM_FORMAT_OPENAI_COMPATIBLE);
  });
});

describe("materializeConnection", () => {
  it("applies deepseek defaults", () => {
    const cfg = llmProviderSchema.parse({
      preset: LLM_PRESET_DEEPSEEK,
      api_key: "k",
    });
    const m = materializeConnection(cfg);
    expect(m.formatId).toBe(LLM_FORMAT_OPENAI_COMPATIBLE);
    expect(m.baseUrl).toBe("https://api.deepseek.com");
    expect(m.resolveFormat).toBeUndefined();
  });

  it("opencode_go is a gateway", () => {
    const cfg = llmProviderSchema.parse({
      preset: LLM_PRESET_OPENCODE_GO,
      api_key: "k",
    });
    const m = materializeConnection(cfg);
    expect(m.baseUrl).toBe("https://opencode.ai/zen/go/v1");
    expect(m.resolveFormat?.("gpt-5.6-luna")).toBe(LLM_FORMAT_OPENAI_RESPONSES);
  });

  it("custom requires format + base_url", () => {
    const cfg = llmProviderSchema.parse({
      preset: LLM_PRESET_CUSTOM,
      format: LLM_FORMAT_OPENAI_RESPONSES,
      base_url: "https://api.openai.com/v1",
      api_key: "k",
    });
    expect(materializeConnection(cfg).formatId).toBe(LLM_FORMAT_OPENAI_RESPONSES);
  });
});

describe("providerConfigToSpec", () => {
  it("attaches resolveFormat for gateway", () => {
    const cfg = llmProviderSchema.parse({
      preset: LLM_PRESET_OPENCODE_GO,
      api_key: "sk",
    });
    const spec = providerConfigToSpec("go", cfg);
    expect(spec.backendId).toBe(LLM_FORMAT_OPENAI_COMPATIBLE);
    expect(spec.resolveFormat?.("minimax-m3")).toBe(LLM_FORMAT_ANTHROPIC_MESSAGES);
    expect(spec.context.baseUrl).toBe("https://opencode.ai/zen/go/v1");
  });
});

describe("effectiveProviderModalities", () => {
  it("alibaba preset supplies voice even when stored voice_protocol is null", () => {
    const m = effectiveProviderModalities({
      preset: LLM_PRESET_ALIBABA_TOKEN_PLAN,
      voice_protocol: null,
    });
    expect(m.voice_protocol).toBe("alibaba_audio");
    expect(m.image_protocol).toBe("alibaba_multimodal");
  });

  it("custom connection reads stored fields", () => {
    const m = effectiveProviderModalities({
      preset: LLM_PRESET_CUSTOM,
      voice_protocol: "edge-tts",
    });
    expect(m.voice_protocol).toBe("edge-tts");
  });
});
