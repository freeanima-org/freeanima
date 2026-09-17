import { describe, it, expect } from "bun:test";
import {
  CONFIG_MASKED_SECRET,
  findForbiddenLlmConfigPatchPath,
  maskConfigSecretsForLlm,
  sanitizeConfigForApi,
} from "./config-sanitize.ts";

describe("sanitizeConfigForApi", () => {
  it("connections.*.api_key 原样返回", () => {
    const out = sanitizeConfigForApi({
      connections: {
        main: {
          preset: "custom",
          custom_kind: "text",
          text_protocol: "openai_compatible",
          base_url: "https://api.openai.com/v1",
          api_key: "sk-secret",
        },
      },
      text_generate: {
        main: { connection: "main", model: "m" },
      },
    });
    const connections = out.connections as Record<string, Record<string, unknown>>;
    expect(connections.main?.api_key).toBe("sk-secret");
  });

  it("database.url 原样返回", () => {
    const out = sanitizeConfigForApi({
      database: { url: "postgresql://anima:secretpass@127.0.0.1:5432/anima" },
    });
    expect(out.database).toEqual({
      url: "postgresql://anima:secretpass@127.0.0.1:5432/anima",
    });
  });

  it("push.pushdeer.pushkey 原样返回", () => {
    const out = sanitizeConfigForApi({
      push: {
        provider: "pushdeer",
        pushdeer: { pushkey: "real-key", api_base: "https://api2.pushdeer.com" },
      },
    });
    expect(out.push).toEqual({
      provider: "pushdeer",
      pushdeer: { pushkey: "real-key", api_base: "https://api2.pushdeer.com" },
    });
  });

  it("MCP env and headers round-trip in cleartext", () => {
    const out = sanitizeConfigForApi({
      mcp_servers: {
        db: {
          command: "node",
          transport: "stdio",
          env: { SECRET: "hidden", OTHER: "x" },
        },
        remote: {
          url: "https://example.com/mcp",
          transport: "sse",
          headers: { Authorization: "Bearer tok" },
        },
      },
    } as never);
    expect(out.mcp_servers).toEqual({
      db: {
        command: "node",
        transport: "stdio",
        env: { SECRET: "hidden", OTHER: "x" },
      },
      remote: {
        url: "https://example.com/mcp",
        transport: "sse",
        headers: { Authorization: "Bearer tok" },
      },
    });
  });

  it("identity 仅保留公开字段", () => {
    const out = sanitizeConfigForApi({
      identity: {
        habitat_instance_id: "fa_inst_abc",
        public_key: "pub",
        private_key: "priv",
        subject_keys: { s1: { public_key: "sp", private_key: "sk" } },
      },
    });
    expect(out.identity).toEqual({
      habitat_instance_id: "fa_inst_abc",
      public_key: "pub",
    });
  });
});

describe("maskConfigSecretsForLlm", () => {
  it("掩码 connections.*.api_key", () => {
    const out = maskConfigSecretsForLlm({
      connections: {
        main: {
          preset: "custom",
          custom_kind: "text",
          text_protocol: "openai_compatible",
          base_url: "https://api.openai.com/v1",
          api_key: "sk-secret",
        },
      },
      text_generate: {
        main: { connection: "main", model: "m" },
      },
    });
    const connections = out.connections as Record<string, Record<string, unknown>>;
    expect(connections.main?.api_key).toBe(CONFIG_MASKED_SECRET);
    expect(connections.main?.base_url).toBe("https://api.openai.com/v1");
  });

  it("掩码 database.url", () => {
    const out = maskConfigSecretsForLlm({
      database: { url: "postgresql://anima:secretpass@127.0.0.1:5432/anima" },
    });
    expect(out.database).toEqual({ url: CONFIG_MASKED_SECRET });
  });

  it("掩码 MCP env 与 headers 字符串值", () => {
    const out = maskConfigSecretsForLlm({
      mcp_servers: {
        db: {
          command: "node",
          transport: "stdio",
          env: { SECRET: "hidden", OTHER: "x" },
        },
        remote: {
          url: "https://example.com/mcp",
          transport: "sse",
          headers: { Authorization: "Bearer tok" },
        },
      },
    });
    expect(out.mcp_servers).toEqual({
      db: {
        command: "node",
        transport: "stdio",
        env: { SECRET: CONFIG_MASKED_SECRET, OTHER: CONFIG_MASKED_SECRET },
      },
      remote: {
        url: "https://example.com/mcp",
        transport: "sse",
        headers: { Authorization: CONFIG_MASKED_SECRET },
      },
    });
  });
});

describe("findForbiddenLlmConfigPatchPath", () => {
  it("检出密钥键路径", () => {
    expect(
      findForbiddenLlmConfigPatchPath({
        providers: { main: { api_key: "x", model: "m" } },
      }),
    ).toBe("providers.main.api_key");
  });

  it("检出 mcp env / headers", () => {
    expect(findForbiddenLlmConfigPatchPath({ env: { A: "1" } })).toBe("env");
    expect(findForbiddenLlmConfigPatchPath({ headers: { H: "1" } })).toBe("headers");
  });

  it("无禁字段返回 null", () => {
    expect(findForbiddenLlmConfigPatchPath({ model: "m", base_url: "https://x" })).toBeNull();
  });
});
