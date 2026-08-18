import { describe, it, expect } from "bun:test";
import { Config } from "@freeanima/habitat/core/config";
import { runtimeConfigSchema } from "@freeanima/habitat/core/config";
import {
  getProfileHopModel,
  isLlmConfigured,
  LLM_NOT_CONFIGURED_MESSAGE,
  resolveConfiguredProfileId,
  resolveScene,
  resolveVideoGenerate,
  tryGetTextGenerateMain,
} from "./llm-config.ts";
import { connectionSchema } from "./schemas/llm-config.ts";
import { minimalChatRuntime } from "./test-helpers/minimal-llm-config.ts";

const CHAT_ONLY_SNAPSHOT = runtimeConfigSchema.parse(minimalChatRuntime({ model: "chat-model" }));

function chatOnlyConfig() {
  return Config.fromSnapshot(CHAT_ONLY_SNAPSHOT);
}

describe("resolveConfiguredProfileId", () => {
  it("returns preferred profile when configured", () => {
    const cfg = chatOnlyConfig().data;
    expect(resolveConfiguredProfileId(cfg, "chat")).toBe("chat");
  });

  it("falls back to main when child scene is omitted", () => {
    const cfg = chatOnlyConfig().data;
    expect(getProfileHopModel(cfg, "summary")).toBe("chat-model");
    expect(getProfileHopModel(cfg, "reflect")).toBe("chat-model");
    expect(resolveScene(cfg, "summary").model).toBe("chat-model");
  });

  it("getProfileHopModel uses main model for omitted child", () => {
    const cfg = chatOnlyConfig().data;
    expect(getProfileHopModel(cfg, "summary")).toBe("chat-model");
  });

  it("child binding null/omitted inherits main", () => {
    const snap = runtimeConfigSchema.parse({
      ...minimalChatRuntime({ model: "chat-model" }),
      text_generate: {
        main: { connection: "main", model: "chat-model" },
        summary: null,
        reflect: null,
      },
    });
    const cfg = Config.fromSnapshot(snap).data;
    expect(resolveScene(cfg, "summary").model).toBe("chat-model");
    expect(resolveScene(cfg, "reflect").model).toBe("chat-model");
  });

  it("child binding selects that connection/model", () => {
    const snap = runtimeConfigSchema.parse({
      connections: {
        main: {
          preset: "custom",
          custom_kind: "text",
          text_protocol: "openai_compatible",
          base_url: "https://api.openai.com/v1",
          api_key: "k",
        },
        cheap: {
          preset: "custom",
          custom_kind: "text",
          text_protocol: "openai_compatible",
          base_url: "https://api.openai.com/v1",
          api_key: "k",
        },
      },
      text_generate: {
        main: { connection: "main", model: "chat-model" },
        summary: { connection: "cheap", model: "cheap-model" },
      },
    });
    const cfg = Config.fromSnapshot(snap).data;
    expect(resolveConfiguredProfileId(cfg, "summary")).toBe("summary");
    expect(getProfileHopModel(cfg, "summary")).toBe("cheap-model");
  });

  it("flat capability sections resolve without profiles", () => {
    const snap = runtimeConfigSchema.parse({
      connections: {
        main: {
          preset: "custom",
          custom_kind: "text",
          text_protocol: "openai_compatible",
          base_url: "https://api.openai.com/v1",
          api_key: "k",
        },
        img: {
          preset: "custom",
          custom_kind: "image",
          image_protocol: "openai_images",
          base_url: "https://api.openai.com/v1",
          api_key: "k",
        },
        edge: {
          preset: "custom",
          custom_kind: "audio",
          audio_protocol: "edge-tts",
          base_url: "https://api.msedgeservices.com/tts",
          api_key: "",
        },
        vis: {
          preset: "custom",
          custom_kind: "video",
          base_url: "https://example.invalid/v1",
          api_key: "v",
        },
      },
      text_generate: { main: { connection: "main", model: "chat-model" } },
      image_generate: { main: { connection: "img", model: "gpt-image-1" } },
      audio_generate: { main: { connection: "edge", model: "zh-CN-XiaoxiaoNeural" } },
      video_generate: { main: { connection: "vis", model: "wanx-video" } },
    });
    const cfg = Config.fromSnapshot(snap).data;
    expect(isLlmConfigured(cfg)).toBe(true);
    expect(getProfileHopModel(cfg, "chat")).toBe("chat-model");
    const scene = resolveScene(cfg, "image_generate");
    expect(scene.connection).toBe("img");
    expect(scene.model).toBe("gpt-image-1");
    expect(scene.imageProtocol).toBe("openai_images");
    expect(resolveScene(cfg, "tts").model).toBe("zh-CN-XiaoxiaoNeural");
    expect(resolveVideoGenerate(cfg).model).toBe("wanx-video");
  });

  it("isLlmConfigured is false when main points at a non-text connection", () => {
    const snap = runtimeConfigSchema.parse({
      connections: {
        img: {
          preset: "custom",
          custom_kind: "image",
          image_protocol: "openai_images",
          base_url: "https://api.openai.com/v1",
          api_key: "k",
        },
      },
      text_generate: { main: { connection: "img", model: "gpt-image-1" } },
    });
    expect(isLlmConfigured(Config.fromSnapshot(snap).data)).toBe(false);
  });

  it("audio child tts inherits main", () => {
    const withMain = runtimeConfigSchema.parse({
      connections: {
        main: {
          preset: "custom",
          custom_kind: "text",
          text_protocol: "openai_compatible",
          base_url: "https://api.openai.com/v1",
          api_key: "k",
        },
        edge: {
          preset: "custom",
          custom_kind: "audio",
          audio_protocol: "edge-tts",
          base_url: "https://api.msedgeservices.com/tts",
          api_key: "",
        },
      },
      text_generate: { main: { connection: "main", model: "chat-model" } },
      audio_generate: { main: { connection: "edge", model: "zh-CN-XiaoxiaoNeural" } },
    });
    const cfgMain = Config.fromSnapshot(withMain).data;
    expect(resolveScene(cfgMain, "tts").model).toBe("zh-CN-XiaoxiaoNeural");
    expect(resolveScene(cfgMain, "voice_generate").model).toBe("zh-CN-XiaoxiaoNeural");
  });

  it("explicit child overrides inherit", () => {
    const snap = runtimeConfigSchema.parse({
      connections: {
        main: {
          preset: "custom",
          custom_kind: "text",
          text_protocol: "openai_compatible",
          base_url: "https://api.openai.com/v1",
          api_key: "k",
        },
      },
      text_generate: {
        main: { connection: "main", model: "chat-model" },
        summary: { connection: "main", model: "summary-model" },
      },
    });
    const cfg = Config.fromSnapshot(snap).data;
    expect(resolveConfiguredProfileId(cfg, "summary")).toBe("summary");
    expect(getProfileHopModel(cfg, "summary")).toBe("summary-model");
  });
});

describe("connection title + schema", () => {
  it("keeps title and omits blank title", () => {
    const a = connectionSchema.parse({
      title: "  DeepSeek  ",
      preset: "deepseek",
      api_key: "k",
    });
    const b = connectionSchema.parse({
      title: "   ",
      preset: "custom",
      custom_kind: "text",
      text_protocol: "openai_compatible",
      base_url: "https://example.com/v1",
      api_key: "k",
    });
    expect(a.title).toBe("DeepSeek");
    expect(b.title).toBeUndefined();
  });

  it("custom cannot set builtin-only protocols", () => {
    expect(() =>
      connectionSchema.parse({
        preset: "custom",
        custom_kind: "image",
        image_protocol: "alibaba_multimodal",
        base_url: "https://example.com/v1",
        api_key: "k",
      }),
    ).toThrow(/generic protocol/);
  });
});

describe("LLM optional at cold start", () => {
  it("tryGetTextGenerateMain / isLlmConfigured handle missing sections", () => {
    const empty = {} as import("@freeanima/habitat/core/config").RuntimeConfig;
    expect(tryGetTextGenerateMain(empty)).toBeNull();
    expect(isLlmConfigured(empty)).toBe(false);
    expect(() => resolveScene(empty, "chat")).toThrow(/missing connection\/model/);
    expect(LLM_NOT_CONFIGURED_MESSAGE).not.toMatch(/config\.yaml/);
  });

  it("isLlmConfigured is false for empty connections", () => {
    const cfg = {
      connections: {},
      text_generate: { main: { connection: "main", model: "m" } },
    } as import("@freeanima/habitat/core/config").RuntimeConfig;
    expect(isLlmConfigured(cfg)).toBe(false);
  });

  it("connectionSchema requires custom_kind + text_protocol for custom text", () => {
    const provider = connectionSchema.parse({
      preset: "custom",
      custom_kind: "text",
      text_protocol: "openai_compatible",
      base_url: "https://opencode.ai/zen/go/v1",
      api_key: "sk-test",
    });
    expect(provider.text_protocol).toBe("openai_compatible");
    expect(provider.preset).toBe("custom");
    expect(provider.custom_kind).toBe("text");
  });
});
