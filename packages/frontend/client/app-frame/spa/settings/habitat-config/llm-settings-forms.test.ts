import { describe, expect, it } from "bun:test";
import {
  callParamsRoundTrip,
  connectionListSubtitle,
  llmEntryTitle,
  newConnectionId,
  newSceneId,
  profilesDraftToPatch,
  providersDraftToPatch,
  readProvidersDraft,
  readScenesUiDraft,
  sceneDraftVoice,
  scenesUiDraftToPatch,
  systemPurposeSelectValue,
  validateTimeoutDraft,
  withSceneDraftVoice,
} from "./llm-settings-draft.ts";

describe("providersDraftToPatch", () => {
  it("补上 UI 展示了但草稿未写入的默认 format/preset", () => {
    const patched = providersDraftToPatch({
      "opencode-go": {
        base_url: "https://opencode.ai/zen/go/v1",
        api_key: "sk-test",
      },
    });
    expect(patched["opencode-go"]).toMatchObject({
      preset: "custom",
      format: "openai_compatible",
      base_url: "https://opencode.ai/zen/go/v1",
    });
  });

  it("readProvidersDraft 与保存规范化一致", () => {
    expect(
      readProvidersDraft({
        main: { base_url: "https://example.com/v1" },
      }),
    ).toEqual({
      main: {
        base_url: "https://example.com/v1",
        preset: "custom",
        format: "openai_compatible",
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

describe("call params / profiles", () => {
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

  it("profilesDraftToPatch 去掉空 hop", () => {
    const patched = profilesDraftToPatch({
      chat: {
        chain: [
          { provider: "main", model: "m1" },
          { provider: "", model: "" },
        ],
      },
    });
    expect(patched.chat).toMatchObject({
      chain: [{ provider: "main", model: "m1" }],
    });
  });

  it("profilesDraftToPatch 保留 title、省略空白 title", () => {
    const patched = profilesDraftToPatch({
      a: { title: " 主方案 ", chain: [{ provider: "main", model: "m1" }] },
      b: { title: "  ", chain: [{ provider: "main", model: "m2" }] },
    });
    expect(patched.a).toMatchObject({ title: "主方案" });
    expect((patched.b as Record<string, unknown>).title).toBeUndefined();
  });
});

describe("connectionListSubtitle", () => {
  it("自定义未填 URL", () => {
    expect(connectionListSubtitle({ preset: "custom" })).toContain("未填 Base URL");
  });

  it("预设固定展示默认 API 根", () => {
    expect(connectionListSubtitle({ preset: "deepseek" })).toContain("api.deepseek.com");
  });
});

describe("llmEntryTitle / ids / bindings UI", () => {
  it("title 优先，否则回退 id 或内置名", () => {
    expect(llmEntryTitle("c-1", { title: " DeepSeek " })).toBe("DeepSeek");
    expect(llmEntryTitle("c-1", {})).toBe("c-1");
    expect(llmEntryTitle("chat", {}, "聊天")).toBe("聊天");
  });

  it("自动生成连接/方案 id 前缀", () => {
    expect(newConnectionId()).toMatch(/^c-[0-9a-f]{8}$/);
    expect(newSceneId()).toMatch(/^s-[0-9a-f]{8}$/);
  });

  it("systemPurposeSelectValue：bindings 与旧配置回显", () => {
    const profiles = {
      chat: { chain: [{ provider: "main", model: "m" }] },
      summary: { chain: [{ provider: "main", model: "s" }] },
      cheap: { chain: [{ provider: "main", model: "c" }] },
    };
    expect(systemPurposeSelectValue("summary", { summary: null }, profiles)).toBe("");
    expect(systemPurposeSelectValue("summary", { summary: "cheap" }, profiles)).toBe("cheap");
    expect(systemPurposeSelectValue("summary", {}, profiles)).toBe("summary");
    expect(systemPurposeSelectValue("reflect", {}, profiles)).toBe("");
  });
});

describe("scenes UI draft", () => {
  it("readScenesUiDraft：优先 scenes，子用途缺省为同主场景", () => {
    const draft = readScenesUiDraft({
      scenes: {
        chat: { connection: "main", model: "m1" },
        summary: { connection: "main", model: "s1" },
      },
      profiles: {
        chat: { chain: [{ provider: "legacy", model: "old" }] },
      },
    });
    expect(draft.chat).toEqual({ connection: "main", model: "m1" });
    expect(draft.summary).toEqual({ connection: "main", model: "s1" });
    expect(draft.reflect).toBeNull();
  });

  it("readScenesUiDraft：无 scenes 时 chat 回退 profile chain", () => {
    const draft = readScenesUiDraft({
      profiles: {
        chat: { chain: [{ provider: "main", model: "from-profile" }] },
      },
    });
    expect(draft.chat).toEqual({ connection: "main", model: "from-profile" });
  });

  it("scenesUiDraftToPatch：null/空删除键，完整绑定写入", () => {
    const patched = scenesUiDraftToPatch(
      {
        chat: { connection: "main", model: "m1" },
        summary: null,
        reflect: { connection: "main", model: "" },
      },
      {
        chat: { connection: "old", model: "o" },
        summary: { connection: "old", model: "s" },
        reflect: { connection: "old", model: "r" },
        keep: { connection: "x", model: "y" },
      },
      ["chat", "summary", "reflect"],
    );
    expect(patched.chat).toEqual({ connection: "main", model: "m1" });
    expect(patched.summary).toBeNull();
    expect(patched.reflect).toBeNull();
    expect(patched.keep).toBeUndefined();
  });

  it("scenesUiDraftToPatch 保留 params.voice", () => {
    const patched = scenesUiDraftToPatch(
      {
        voice_generate: {
          connection: "ali",
          model: "qwen-audio-3.0-tts-plus",
          params: { voice: "longanlingxin" },
        },
      },
      {},
      ["voice_generate"],
    );
    expect(patched.voice_generate).toEqual({
      connection: "ali",
      model: "qwen-audio-3.0-tts-plus",
      params: { voice: "longanlingxin" },
    });
  });

  it("readScenesUiDraft 读出 params.voice", () => {
    const draft = readScenesUiDraft({
      scenes: {
        voice_generate: {
          connection: "ali",
          model: "qwen-audio-3.0-tts-plus",
          params: { voice: "longanlufeng" },
        },
      },
    });
    expect(draft.voice_generate).toEqual({
      connection: "ali",
      model: "qwen-audio-3.0-tts-plus",
      params: { voice: "longanlufeng" },
    });
    expect(sceneDraftVoice(draft.voice_generate!)).toBe("longanlufeng");
    expect(sceneDraftVoice(withSceneDraftVoice(draft.voice_generate!, ""))).toBe("");
  });
});
