import { describe, it, expect } from "bun:test";
import { Config } from "@freeanima/habitat/core/config";
import { runtimeConfigSchema } from "@freeanima/habitat/core/config";
import {
  getLlmConfig,
  getProfileHopModel,
  isLlmConfigured,
  LLM_NOT_CONFIGURED_MESSAGE,
  resolveConfiguredProfileId,
  resolveLlmConfigView,
  resolveScene,
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

  it("profile_bindings null/empty means 同主场景 → default_profile", () => {
    const snap = runtimeConfigSchema.parse({
      llm: {
        default_profile: "chat",
        providers: {
          main: {
            format: "openai_compatible",
            base_url: "https://api.openai.com/v1",
            api_key: "k",
          },
        },
        profiles: {
          chat: { chain: [{ provider: "main", model: "chat-model" }] },
          cheap: { chain: [{ provider: "main", model: "cheap-model" }] },
          summary: { chain: [{ provider: "main", model: "summary-model" }] },
        },
        profile_bindings: {
          summary: null,
          reflect: "",
        },
      },
    });
    const cfg = Config.fromSnapshot(snap).data;
    expect(resolveConfiguredProfileId(cfg, "summary")).toBe("chat");
    expect(resolveConfiguredProfileId(cfg, "reflect")).toBe("chat");
    expect(getProfileHopModel(cfg, "summary")).toBe("chat-model");
  });

  it("profile_bindings string selects that profile", () => {
    const snap = runtimeConfigSchema.parse({
      llm: {
        default_profile: "chat",
        providers: {
          main: {
            format: "openai_compatible",
            base_url: "https://api.openai.com/v1",
            api_key: "k",
          },
        },
        profiles: {
          chat: { chain: [{ provider: "main", model: "chat-model" }] },
          cheap: { chain: [{ provider: "main", model: "cheap-model" }] },
        },
        profile_bindings: {
          summary: "cheap",
        },
      },
    });
    const cfg = Config.fromSnapshot(snap).data;
    expect(resolveConfiguredProfileId(cfg, "summary")).toBe("cheap");
    expect(getProfileHopModel(cfg, "summary")).toBe("cheap-model");
  });

  it("flat scenes resolve without profiles hop", () => {
    const snap = runtimeConfigSchema.parse({
      llm: {
        default_profile: "chat",
        providers: {
          main: {
            format: "openai_compatible",
            base_url: "https://api.openai.com/v1",
            api_key: "k",
            image_protocol: "openai_images",
          },
          edge: {
            preset: "custom",
            voice_protocol: "edge-tts",
            base_url: "https://api.msedgeservices.com/tts",
            api_key: "",
          },
        },
        profiles: {},
        scenes: {
          chat: { connection: "main", model: "chat-model" },
          image_generate: { connection: "main", model: "gpt-image-1" },
          tts: { connection: "edge", model: "zh-CN-XiaoxiaoNeural" },
        },
      },
    });
    const cfg = Config.fromSnapshot(snap).data;
    expect(isLlmConfigured(cfg)).toBe(true);
    expect(getProfileHopModel(cfg, "chat")).toBe("chat-model");
    const scene = resolveScene(cfg, "image_generate");
    expect(scene.connection).toBe("main");
    expect(scene.model).toBe("gpt-image-1");
    expect(scene.imageProtocol).toBe("openai_images");
    const view = resolveLlmConfigView(cfg);
    expect(view.profiles.tts).toBeUndefined();
    expect(view.profiles.image_generate).toBeUndefined();
    expect(view.scenes?.tts?.connection).toBe("edge");
  });

  it("voice child tts inherits voice_generate; legacy tts promotes main", () => {
    const withMain = runtimeConfigSchema.parse({
      llm: {
        default_profile: "chat",
        providers: {
          main: {
            format: "openai_compatible",
            base_url: "https://api.openai.com/v1",
            api_key: "k",
          },
          edge: {
            preset: "custom",
            voice_protocol: "edge-tts",
            base_url: "https://api.msedgeservices.com/tts",
            api_key: "",
          },
        },
        profiles: {},
        scenes: {
          chat: { connection: "main", model: "chat-model" },
          voice_generate: { connection: "edge", model: "zh-CN-XiaoxiaoNeural" },
        },
      },
    });
    const cfgMain = Config.fromSnapshot(withMain).data;
    expect(resolveConfiguredProfileId(cfgMain, "tts")).toBe("voice_generate");
    expect(resolveScene(cfgMain, "tts").model).toBe("zh-CN-XiaoxiaoNeural");
    expect(resolveLlmConfigView(cfgMain).scenes?.tts?.connection).toBe("edge");

    const legacyOnly = runtimeConfigSchema.parse({
      llm: {
        default_profile: "chat",
        providers: {
          main: {
            format: "openai_compatible",
            base_url: "https://api.openai.com/v1",
            api_key: "k",
          },
          edge: {
            preset: "custom",
            voice_protocol: "edge-tts",
            base_url: "https://api.msedgeservices.com/tts",
            api_key: "",
          },
        },
        profiles: {},
        scenes: {
          chat: { connection: "main", model: "chat-model" },
          tts: { connection: "edge", model: "zh-CN-YunxiNeural" },
        },
      },
    });
    const cfgLegacy = Config.fromSnapshot(legacyOnly).data;
    expect(resolveConfiguredProfileId(cfgLegacy, "voice_generate")).toBe("tts");
    expect(resolveScene(cfgLegacy, "voice_generate").model).toBe("zh-CN-YunxiNeural");
    expect(resolveLlmConfigView(cfgLegacy).scenes?.voice_generate?.model).toBe("zh-CN-YunxiNeural");
  });

  it("absent binding key keeps legacy self profile when usable", () => {
    const snap = runtimeConfigSchema.parse({
      llm: {
        default_profile: "chat",
        providers: {
          main: {
            format: "openai_compatible",
            base_url: "https://api.openai.com/v1",
            api_key: "k",
          },
        },
        profiles: {
          chat: { chain: [{ provider: "main", model: "chat-model" }] },
          summary: { chain: [{ provider: "main", model: "summary-model" }] },
        },
      },
    });
    const cfg = Config.fromSnapshot(snap).data;
    expect(resolveConfiguredProfileId(cfg, "summary")).toBe("summary");
    expect(getProfileHopModel(cfg, "summary")).toBe("summary-model");
  });
});

describe("llm title + profile_bindings schema", () => {
  it("keeps title and omits blank title on provider/profile", () => {
    const parsed = llmConfigSchema.parse({
      providers: {
        a: {
          title: "  DeepSeek  ",
          preset: "deepseek",
          api_key: "k",
        },
        b: {
          title: "   ",
          format: "openai_compatible",
          base_url: "https://example.com/v1",
          api_key: "k",
        },
      },
      profiles: {
        chat: {
          title: "主对话",
          chain: [{ provider: "a", model: "m" }],
        },
        other: {
          title: "",
          chain: [{ provider: "a", model: "m2" }],
        },
      },
      profile_bindings: { summary: null, reflect: "other" },
    });
    expect(parsed.providers.a?.title).toBe("DeepSeek");
    expect(parsed.providers.b?.title).toBeUndefined();
    expect(parsed.profiles.chat?.title).toBe("主对话");
    expect(parsed.profiles.other?.title).toBeUndefined();
    expect(parsed.profile_bindings).toEqual({ summary: null, reflect: "other" });
  });
});

describe("LLM optional at cold start", () => {
  it("tryGetLlmConfig / isLlmConfigured handle missing llm", () => {
    const empty = {} as import("@freeanima/habitat/core/config").RuntimeConfig;
    expect(tryGetLlmConfig(empty)).toBeUndefined();
    expect(isLlmConfigured(empty)).toBe(false);
    expect(() => getLlmConfig(empty)).toThrow(LLM_NOT_CONFIGURED_MESSAGE);
    expect(() => getLlmConfig(empty)).not.toThrow(/config\.yaml/);
  });

  it("isLlmConfigured is false for empty profiles", () => {
    const cfg = {
      llm: { default_profile: "chat", providers: {}, profiles: {} },
    } as import("@freeanima/habitat/core/config").RuntimeConfig;
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
