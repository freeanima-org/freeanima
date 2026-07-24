import { describe, expect, it } from "bun:test";

import { CONFIG_MASKED_SECRET } from "./config-sanitize.ts";
import { restoreMaskedSecrets } from "./restore-masked-secrets.ts";

describe("restoreMaskedSecrets", () => {
  it("keeps real api_key when patch sends masked placeholder", () => {
    const existing = {
      default_profile: "chat",
      providers: {
        main: {
          backend: "openai_compatible",
          base_url: "https://api.openai.com/v1",
          api_key: "sk-secret",
        },
      },
    };
    const patch = {
      providers: {
        main: {
          backend: "openai_compatible",
          base_url: "https://api.openai.com/v1",
          api_key: CONFIG_MASKED_SECRET,
        },
      },
    };
    const out = restoreMaskedSecrets(patch, existing);
    const providers = out.providers as Record<string, Record<string, unknown>>;
    expect(providers.main?.api_key).toBe("sk-secret");
    expect(providers.main?.base_url).toBe("https://api.openai.com/v1");
  });

  it("allows explicit empty clear", () => {
    const out = restoreMaskedSecrets(
      { providers: { main: { api_key: "" } } },
      { providers: { main: { api_key: "sk-secret" } } },
    );
    const providers = out.providers as Record<string, Record<string, unknown>>;
    expect(providers.main?.api_key).toBe("");
  });

  it("accepts a new real secret", () => {
    const out = restoreMaskedSecrets(
      { providers: { main: { api_key: "sk-new" } } },
      { providers: { main: { api_key: "sk-old" } } },
    );
    const providers = out.providers as Record<string, Record<string, unknown>>;
    expect(providers.main?.api_key).toBe("sk-new");
  });

  it("preserves vault() reference when masked", () => {
    const out = restoreMaskedSecrets(
      { providers: { main: { api_key: CONFIG_MASKED_SECRET } } },
      { providers: { main: { api_key: 'vault("12", "password")' } } },
    );
    const providers = out.providers as Record<string, Record<string, unknown>>;
    expect(providers.main?.api_key).toBe('vault("12", "password")');
  });
});
