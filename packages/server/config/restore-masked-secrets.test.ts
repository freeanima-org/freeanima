import { describe, expect, it } from "bun:test";

import { CONFIG_MASKED_SECRET } from "./config-sanitize.ts";
import { restoreMaskedSecrets } from "./restore-masked-secrets.ts";

describe("restoreMaskedSecrets", () => {
  it("keeps real api_key when patch sends masked placeholder", () => {
    const existing = {
      main: {
        preset: "custom",
        custom_kind: "text",
        text_protocol: "openai_compatible",
        base_url: "https://api.openai.com/v1",
        api_key: "sk-secret",
      },
    };
    const patch = {
      main: {
        preset: "custom",
        custom_kind: "text",
        text_protocol: "openai_compatible",
        base_url: "https://api.openai.com/v1",
        api_key: CONFIG_MASKED_SECRET,
      },
    };
    const out = restoreMaskedSecrets(patch, existing);
    const main = out.main as Record<string, unknown>;
    expect(main.api_key).toBe("sk-secret");
    expect(main.base_url).toBe("https://api.openai.com/v1");
  });

  it("allows explicit empty clear", () => {
    const out = restoreMaskedSecrets({ main: { api_key: "" } }, { main: { api_key: "sk-secret" } });
    expect((out.main as Record<string, unknown>).api_key).toBe("");
  });

  it("accepts a new real secret", () => {
    const out = restoreMaskedSecrets(
      { main: { api_key: "sk-new" } },
      { main: { api_key: "sk-old" } },
    );
    expect((out.main as Record<string, unknown>).api_key).toBe("sk-new");
  });

  it("preserves vault() reference when masked", () => {
    const out = restoreMaskedSecrets(
      { main: { api_key: CONFIG_MASKED_SECRET } },
      { main: { api_key: 'vault("12", "password")' } },
    );
    expect((out.main as Record<string, unknown>).api_key).toBe('vault("12", "password")');
  });
});
