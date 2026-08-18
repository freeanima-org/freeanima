import { describe, expect, it } from "bun:test";
import {
  callParamsRoundTrip,
  capabilityUiDraftToSection,
  applyCustomKindToConnectionEntry,
  connectionListSubtitle,
  emptyConnectionEntry,
  llmEntryTitle,
  newConnectionId,
  providersDraftToPatch,
  readCapabilityUiDraft,
  readProvidersDraft,
  validateTimeoutDraft,
  LLM_SETTINGS_GENERIC_AUDIO_PROTOCOLS,
  LLM_SETTINGS_GENERIC_IMAGE_PROTOCOLS,
} from "./llm-settings-draft.ts";

describe("providersDraftToPatch", () => {
  it("自定义文本补 custom_kind 与 text_protocol", () => {
    const patched = providersDraftToPatch({
      "opencode-go": {
        preset: "custom",
        custom_kind: "text",
        text_protocol: "openai_compatible",
        base_url: "https://opencode.ai/zen/go/v1",
        api_key: "sk-test",
      },
    });
    expect(patched["opencode-go"]).toMatchObject({
      preset: "custom",
      custom_kind: "text",
      text_protocol: "openai_compatible",
      base_url: "https://opencode.ai/zen/go/v1",
    });
    expect((patched["opencode-go"] as Record<string, unknown>).format).toBeUndefined();
  });

  it("readProvidersDraft 与保存规范化一致", () => {
    expect(
      readProvidersDraft({
        main: {
          preset: "custom",
          custom_kind: "text",
          text_protocol: "openai_compatible",
          base_url: "https://example.com/v1",
        },
      }),
    ).toMatchObject({
      main: {
        base_url: "https://example.com/v1",
        preset: "custom",
        custom_kind: "text",
        text_protocol: "openai_compatible",
      },
    });
  });
});

describe("validateTimeoutDraft", () => {
  it("首字节超过整体时报错", () => {
    expect(
      validateTimeoutDraft({
        timeout_ms: 1000,
        first_byte_timeout_ms: 2000,
        idle_timeout_ms: "",
      }),
    ).toBe("首字节超时须 ≤ 整体超时");
  });

  it("空整体时不校验", () => {
    expect(
      validateTimeoutDraft({
        timeout_ms: "",
        first_byte_timeout_ms: 2000,
        idle_timeout_ms: "",
      }),
    ).toBeNull();
  });
});

describe("call params", () => {
  it("不提供 extra 编辑面，但回写保留已有 extra", () => {
    expect(
      callParamsRoundTrip({
        temperature: 0.5,
        extra: { foo: 1 },
      }),
    ).toEqual({
      temperature: 0.5,
      extra: { foo: 1 },
    });
  });
});

describe("connectionListSubtitle", () => {
  it("自定义未填 URL", () => {
    expect(connectionListSubtitle({ preset: "custom", custom_kind: "text" })).toContain(
      "未填 Base URL",
    );
  });

  it("预设固定展示默认 API 根", () => {
    expect(connectionListSubtitle({ preset: "deepseek" })).toContain("api.deepseek.com");
  });
});

describe("llmEntryTitle / ids", () => {
  it("title 优先，否则回退 id 或内置名", () => {
    expect(llmEntryTitle("c-1", { title: " DeepSeek " })).toBe("DeepSeek");
    expect(llmEntryTitle("c-1", {})).toBe("c-1");
    expect(llmEntryTitle("chat", {}, "聊天")).toBe("聊天");
  });

  it("自动生成连接 id 前缀", () => {
    expect(newConnectionId()).toMatch(/^c-[0-9a-f]{8}$/);
  });

  it("emptyConnectionEntry 按层只带一层协议", () => {
    expect(emptyConnectionEntry("text")).toMatchObject({
      preset: "custom",
      custom_kind: "text",
      text_protocol: "openai_compatible",
    });
    expect(emptyConnectionEntry("image").text_protocol).toBeUndefined();
    expect(emptyConnectionEntry("video").video_protocol).toBeUndefined();
  });

  it("自定义协议表不含内置专用协议；换层只保留该层协议", () => {
    expect(LLM_SETTINGS_GENERIC_IMAGE_PROTOCOLS.map((p) => p.id)).toEqual(["openai_images"]);
    expect(LLM_SETTINGS_GENERIC_AUDIO_PROTOCOLS.map((p) => p.id)).toEqual([
      "openai_audio_speech",
      "edge-tts",
    ]);
    const image = applyCustomKindToConnectionEntry(
      { ...emptyConnectionEntry("text"), api_key: "k", title: "x" },
      "image",
    );
    expect(image).toMatchObject({
      preset: "custom",
      custom_kind: "image",
      image_protocol: "openai_images",
      title: "x",
      api_key: "k",
    });
    expect(image.text_protocol).toBeUndefined();
  });
});

describe("capability UI draft", () => {
  it("readCapabilityUiDraft：子用途缺省为同主场景", () => {
    const draft = readCapabilityUiDraft(
      {
        main: { connection: "main", model: "m1" },
        summary: { connection: "main", model: "s1" },
      },
      "text_generate",
    );
    expect(draft.chat).toEqual({ connection: "main", model: "m1" });
    expect(draft.summary).toEqual({ connection: "main", model: "s1" });
    expect(draft.reflect).toBeNull();
  });

  it("capabilityUiDraftToSection：省略 inherit 子键", () => {
    const patched = capabilityUiDraftToSection(
      {
        chat: { connection: "main", model: "m1" },
        summary: null,
        reflect: { connection: "main", model: "" },
      },
      "text_generate",
    );
    expect(patched.main).toEqual({ connection: "main", model: "m1" });
    expect(patched.summary).toBeUndefined();
    expect(patched.reflect).toBeUndefined();
  });

  it("capabilityUiDraftToSection 保留 params.voice", () => {
    const patched = capabilityUiDraftToSection(
      {
        voice_generate: {
          connection: "ali",
          model: "qwen-audio-3.0-tts-plus",
          params: { voice: "longanlingxin" },
        },
      },
      "audio_generate",
    );
    expect(patched.main).toEqual({
      connection: "ali",
      model: "qwen-audio-3.0-tts-plus",
      params: { voice: "longanlingxin" },
    });
  });
});
