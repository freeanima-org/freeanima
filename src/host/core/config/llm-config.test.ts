import { describe, it, expect } from "bun:test";
import { Config } from "@freeanima/host/core/config";
import { animaConfigSchema } from "@freeanima/host/core/config";
import {
  getLlmConfig,
  getProfileHopModel,
  isLlmConfigured,
  LLM_NOT_CONFIGURED_MESSAGE,
  resolveConfiguredProfileId,
  tryGetLlmConfig,
} from "./llm-config.ts";
import { llmConfigSchema } from "./schemas/llm-config.ts";

const CHAT_ONLY_SNAPSHOT = animaConfigSchema.parse({
  llm: {
    default_profile: "chat",
    providers: {
      main: {
        backend: "openai_compatible",
        base_url: "https://api.openai.com/v1",
        api_key: "test-key",
      },
    },
    profiles: {
      chat: {
        chain: [{ provider: "main", model: "chat-model" }],
      },
    },
  },
});

function chatOnlyConfig() {
  return Config.fromSnapshot(CHAT_ONLY_SNAPSHOT);
}

describe("resolveConfiguredProfileId", () => {
  it("returns preferred profile when configured", () => {
    const cfg = chatOnlyConfig().data;
    expect(resolveConfiguredProfileId(cfg, "chat")).toBe("chat");
  });

  it("falls back to default_profile when scene profile is missing", () => {
    const cfg = chatOnlyConfig().data;
    expect(resolveConfiguredProfileId(cfg, "summary")).toBe("chat");
    expect(resolveConfiguredProfileId(cfg, "reflect")).toBe("chat");
  });

  it("getProfileHopModel uses fallback model for missing scene profile", () => {
    const cfg = chatOnlyConfig().data;
    expect(getProfileHopModel(cfg, "summary")).toBe("chat-model");
  });
});

describe("LLM optional at cold start", () => {
  it("tryGetLlmConfig / isLlmConfigured handle missing llm", () => {
    const empty = {} as import("@freeanima/host/core/config").AnimaConfig;
    expect(tryGetLlmConfig(empty)).toBeUndefined();
    expect(isLlmConfigured(empty)).toBe(false);
    expect(() => getLlmConfig(empty)).toThrow(LLM_NOT_CONFIGURED_MESSAGE);
    expect(() => getLlmConfig(empty)).not.toThrow(/config\.yaml/);
  });

  it("isLlmConfigured is false for empty profiles", () => {
    const cfg = {
      llm: { default_profile: "chat", providers: {}, profiles: {} },
    } as import("@freeanima/host/core/config").AnimaConfig;
    expect(isLlmConfigured(cfg)).toBe(false);
  });

  it("llmConfigSchema defaults missing backend and profiles", () => {
    const parsed = llmConfigSchema.parse({
      providers: {
        "opencode-go": {
          base_url: "https://opencode.ai/zen/go/v1",
          api_key: "sk-test",
        },
      },
    });
    expect(parsed.providers["opencode-go"]?.backend).toBe("openai_compatible");
    expect(parsed.profiles).toEqual({});
    expect(parsed.default_profile).toBe("chat");
  });
});
