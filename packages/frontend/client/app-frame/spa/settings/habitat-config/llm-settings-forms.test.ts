import { describe, expect, it } from "bun:test";
import {
  callParamsRoundTrip,
  connectionListSubtitle,
  profilesDraftToPatch,
  providersDraftToPatch,
  readProvidersDraft,
  validateTimeoutDraft,
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
});

describe("connectionListSubtitle", () => {
  it("自定义未填 URL", () => {
    expect(connectionListSubtitle({ preset: "custom" })).toContain("未填 Base URL");
  });

  it("预设留空 URL 提示默认", () => {
    expect(connectionListSubtitle({ preset: "deepseek" })).toContain("使用预设默认");
  });
});
