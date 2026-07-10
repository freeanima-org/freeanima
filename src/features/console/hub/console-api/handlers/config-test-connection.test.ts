import { afterEach, describe, expect, it, mock } from "bun:test";

import { Config } from "@freeanima/core/config";
import type { AppRuntimeContext } from "@freeanima/platform/ports/app-runtime-context";
import { sanitizeConfigForApi } from "@freeanima/platform/config";

import { bindConsoleRuntimeContext } from "./runtime.ts";
import { pickConfigString, testConfigConnection } from "./config-test-connection.ts";

const runtimeSnapshot = {
  llm: {
    default_profile: "chat",
    providers: {
      main: {
        backend: "openai_compatible" as const,
        base_url: "https://api.example/v1",
        api_key: "sk-secret",
      },
    },
    profiles: { chat: { chain: [{ provider: "main", model: "m" }] } },
  },
  firecrawl: { api_url: "https://api.firecrawl.dev", api_key: "fc-key" },
  browser: { camofox: { base_url: "http://127.0.0.1:9377" } },
  embedding: {
    enabled: true,
    base_url: "http://127.0.0.1:11434/v1",
    model: "bge-m3",
    api_key: "ollama",
  },
};

function bindTestConsoleContext() {
  const engineConfig = Config.fromSnapshot(runtimeSnapshot);
  const ctx = {
    engine: { config: engineConfig },
    getConfig: () => ({
      config: sanitizeConfigForApi(engineConfig.data),
    }),
  } as unknown as AppRuntimeContext;
  bindConsoleRuntimeContext(() => ctx);
}

describe("pickConfigString", () => {
  it("prefers draft over saved", () => {
    expect(pickConfigString("http://draft", "http://saved")).toBe("http://draft");
  });

  it("falls back when draft is masked", () => {
    expect(pickConfigString("***", "sk-real")).toBe("sk-real");
  });

  it("treats empty draft as explicit empty", () => {
    expect(pickConfigString("", "sk-real")).toBe("");
  });
});

describe("testConfigConnection", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    bindConsoleRuntimeContext();
  });

  it("tests camofox health endpoint", async () => {
    bindTestConsoleContext();
    globalThis.fetch = mock(async (url: string | URL) => {
      expect(String(url)).toBe("http://camofox.test/health");
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }) as unknown as typeof fetch;

    const result = await testConfigConnection({
      service: "camofox",
      config: { base_url: "http://camofox.test" },
    });
    expect(result.ok).toBe(true);
    expect(result.message).toContain("成功");
  });

  it("returns failure when camofox base_url missing", async () => {
    bindTestConsoleContext();
    const result = await testConfigConnection({
      service: "camofox",
      config: { base_url: "" },
    });
    expect(result.ok).toBe(false);
    expect(result.message).toContain("base_url");
  });

  it("requires provider_id for llm_provider", async () => {
    bindTestConsoleContext();
    await expect(
      testConfigConnection({ service: "llm_provider", config: { base_url: "https://x/v1" } }),
    ).rejects.toThrow("provider_id");
  });
});
