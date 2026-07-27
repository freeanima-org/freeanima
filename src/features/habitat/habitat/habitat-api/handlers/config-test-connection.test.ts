import { afterEach, describe, expect, it, mock } from "bun:test";

mock.module("./config-test-gateway-probes.ts", () => ({
  probeDiscordBotToken: async (token: string) => {
    if (token === "bad") throw new Error("invalid token");
    return { tag: "TestBot#0001" };
  },
  probeWeixinIlinkToken: async (token: string, baseUrl?: string) => {
    if (token === "bad") throw new Error("ilink rejected");
    return { base_url: (baseUrl ?? "https://ilinkai.weixin.qq.com").replace(/\/$/, "") };
  },
}));

const s3Write = mock(async () => undefined);
const s3Bytes = mock(async () => new TextEncoder().encode("freeanima-object-storage-probe"));
const s3Delete = mock(async () => undefined);

mock.module("@freeanima/features/object-storage/domain/bun-s3.ts", () => ({
  createBunS3Client: () => ({
    write: s3Write,
    delete: s3Delete,
    file: () => ({
      bytes: s3Bytes,
    }),
  }),
}));

import { Config } from "@freeanima/host/core/config";
import type { AppRuntimeContext } from "@freeanima/host/platform/ports/app-runtime-context";
import { sanitizeConfigForApi } from "@freeanima/host/platform/config";

import { bindHabitatRuntimeContext } from "./runtime.ts";
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
  discord: { enabled: true, token: "discord-saved-token" },
  weixin: { enabled: true, token: "weixin-saved-token", base_url: "https://ilink.test" },
  object_storage: {
    endpoint: "https://s3.example.com",
    region: "cn-hangzhou",
    bucket: "freeanima",
    access_key_id: "saved-ak",
    secret_access_key: "saved-sk",
  },
};

function bindTestConsoleContext(snapshot: Record<string, unknown> = runtimeSnapshot) {
  const engineConfig = Config.fromSnapshot(snapshot);
  const ctx = {
    engine: { config: engineConfig },
    getConfig: () => ({
      config: sanitizeConfigForApi(engineConfig.data),
    }),
  } as unknown as AppRuntimeContext;
  bindHabitatRuntimeContext(() => ctx);
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
    bindHabitatRuntimeContext();
    s3Write.mockReset();
    s3Bytes.mockReset();
    s3Delete.mockReset();
    s3Write.mockImplementation(async () => undefined);
    s3Bytes.mockImplementation(async () =>
      new TextEncoder().encode("freeanima-object-storage-probe"),
    );
    s3Delete.mockImplementation(async () => undefined);
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

  it("tests discord with draft token", async () => {
    bindTestConsoleContext();
    const result = await testConfigConnection({
      service: "discord",
      config: { token: "draft-discord-token" },
    });
    expect(result.ok).toBe(true);
    expect(result.message).toContain("TestBot#0001");
  });

  it("discord falls back to saved token when draft is masked", async () => {
    bindTestConsoleContext();
    const result = await testConfigConnection({
      service: "discord",
      config: { token: "***" },
    });
    expect(result.ok).toBe(true);
    expect(result.message).toContain("成功");
  });

  it("discord fails when token missing", async () => {
    bindTestConsoleContext({
      ...runtimeSnapshot,
      discord: { enabled: true },
    });
    const result = await testConfigConnection({
      service: "discord",
      config: {},
    });
    expect(result.ok).toBe(false);
    expect(result.message).toContain("token");
  });

  it("discord fails when disabled", async () => {
    bindTestConsoleContext({
      ...runtimeSnapshot,
      discord: { enabled: false, token: "x" },
    });
    const result = await testConfigConnection({
      service: "discord",
      config: {},
    });
    expect(result.ok).toBe(false);
    expect(result.message).toContain("禁用");
  });

  it("tests weixin notifyStart", async () => {
    bindTestConsoleContext();
    const result = await testConfigConnection({
      service: "weixin",
      config: { token: "draft-weixin", base_url: "https://ilink.custom" },
    });
    expect(result.ok).toBe(true);
    expect(result.message).toContain("成功");
    expect(result.details?.base_url).toBe("https://ilink.custom");
  });

  it("weixin fails on bad token", async () => {
    bindTestConsoleContext();
    const result = await testConfigConnection({
      service: "weixin",
      config: { token: "bad" },
    });
    expect(result.ok).toBe(false);
    expect(result.message).toContain("失败");
  });

  it("tests object_storage Put/Get via Bun.S3Client", async () => {
    bindTestConsoleContext();
    const result = await testConfigConnection({
      service: "object_storage",
      config: {
        endpoint: "https://s3.example.com",
        bucket: "my-bucket",
        access_key_id: "draft-ak",
        secret_access_key: "draft-sk",
      },
    });
    expect(result.ok).toBe(true);
    expect(result.message).toContain("成功");
    expect(s3Write).toHaveBeenCalled();
    expect(s3Bytes).toHaveBeenCalled();
  });

  it("object_storage fails when bucket missing", async () => {
    bindTestConsoleContext({
      ...runtimeSnapshot,
      object_storage: {
        endpoint: "https://s3.example.com",
        access_key_id: "ak",
        secret_access_key: "sk",
      },
    });
    const result = await testConfigConnection({
      service: "object_storage",
      config: {
        endpoint: "https://s3.example.com",
        bucket: "",
        access_key_id: "ak",
        secret_access_key: "sk",
      },
    });
    expect(result.ok).toBe(false);
    expect(result.message).toContain("bucket");
  });

  it("object_storage timeout hints public reachability", async () => {
    bindTestConsoleContext();
    s3Write.mockImplementation(async () => {
      throw new Error("The operation was aborted due to timeout");
    });
    const result = await testConfigConnection({
      service: "object_storage",
      config: {
        endpoint: "https://oss-cn-hangzhou.aliyuncs.com",
        bucket: "my-bucket",
        access_key_id: "ak",
        secret_access_key: "sk",
      },
    });
    expect(result.ok).toBe(false);
    expect(result.message).toContain("超时");
    expect(result.message).toContain("公网");
  });

  it("object_storage internal endpoint hints VPC", async () => {
    bindTestConsoleContext();
    s3Write.mockImplementation(async () => {
      throw new Error("UnknownError");
    });
    const result = await testConfigConnection({
      service: "object_storage",
      config: {
        endpoint: "https://oss-cn-hangzhou-internal.aliyuncs.com",
        bucket: "my-bucket",
        access_key_id: "ak",
        secret_access_key: "sk",
      },
    });
    expect(result.ok).toBe(false);
    expect(result.message).toContain("内网");
  });

  it("object_storage fails when S3 returns error", async () => {
    bindTestConsoleContext();
    s3Write.mockImplementation(async () => {
      throw new Error("AccessDenied");
    });
    const result = await testConfigConnection({
      service: "object_storage",
      config: {
        endpoint: "https://s3.example.com",
        bucket: "my-bucket",
        access_key_id: "ak",
        secret_access_key: "sk",
      },
    });
    expect(result.ok).toBe(false);
    expect(result.message).toContain("AccessDenied");
  });
});
