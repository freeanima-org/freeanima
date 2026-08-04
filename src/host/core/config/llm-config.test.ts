import { describe, it, expect } from "bun:test";
import { Config } from "@freeanima/host/core/config";
import { runtimeConfigSchema } from "@freeanima/host/core/config";
import {
  getLlmConfig,
  getProfileHopModel,
  isLlmConfigured,
  LLM_NOT_CONFIGURED_MESSAGE,
  resolveConfiguredProfileId,
  tryGetLlmConfig,
} from "./llm-config.ts";
import { llmConfigSchema, llmProviderSchema } from "./schemas/llm-config.ts";

const CHAT_ONLY_SNAPSHOT = runtimeConfigSchema.parse({
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
    const empty = {} as import("@freeanima/host/core/config").RuntimeConfig;
    expect(tryGetLlmConfig(empty)).toBeUndefined();
    expect(isLlmConfigured(empty)).toBe(false);
    expect(() => getLlmConfig(empty)).toThrow(LLM_NOT_CONFIGURED_MESSAGE);
    expect(() => getLlmConfig(empty)).not.toThrow(/config\.yaml/);
  });

  it("isLlmConfigured is false for empty profiles", () => {
    const cfg = {
      llm: { default_profile: "chat", providers: {}, profiles: {} },
    } as import("@freeanima/host/core/config").RuntimeConfig;
    expect(isLlmConfigured(cfg)).toBe(false);
  });

  it("llmProviderSchema defaults missing format/preset; llmConfigSchema allows loose providers", () => {
    const provider = llmProviderSchema.parse({
      base_url: "https://opencode.ai/zen/go/v1",
      api_key: "sk-test",
    });
    expect(provider.format).toBe("openai_compatible");
    expect(provider.preset).toBe("custom");

    const parsed = llmConfigSchema.parse({
      providers: {
        "opencode-go": {
          base_url: "https://opencode.ai/zen/go/v1",
          api_key: "sk-test",
        },
      },
    });
    expect(parsed.profiles).toEqual({});
    expect(parsed.providers["opencode-go"]?.base_url).toBe("https://opencode.ai/zen/go/v1");
    expect(parsed.default_profile).toBe("chat");
  });
});
