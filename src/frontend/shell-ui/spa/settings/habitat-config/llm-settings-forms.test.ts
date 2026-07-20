import { describe, expect, it } from "bun:test";
import { providersDraftToPatch, readProvidersDraft } from "./llm-settings-forms.tsx";

describe("providersDraftToPatch", () => {
  it("补上 UI 展示了但草稿未写入的默认 backend", () => {
    const patched = providersDraftToPatch({
      "opencode-go": {
        base_url: "https://opencode.ai/zen/go/v1",
        api_key: "sk-test",
      },
    });
    expect(patched["opencode-go"]).toMatchObject({
      backend: "openai_compatible",
      base_url: "https://opencode.ai/zen/go/v1",
    });
  });

  it("readProvidersDraft 与保存规范化一致", () => {
    expect(
      readProvidersDraft({
        main: { base_url: "https://example.com/v1" },
      }),
    ).toEqual({
      main: { base_url: "https://example.com/v1", backend: "openai_compatible" },
    });
  });
});
