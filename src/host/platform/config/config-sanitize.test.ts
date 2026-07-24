import { describe, it, expect } from "bun:test";
import { sanitizeConfigForApi } from "./config-sanitize.ts";

describe("sanitizeConfigForApi", () => {
  it("llm.providers.api_key 原样返回", () => {
    const out = sanitizeConfigForApi({
      llm: {
        default_profile: "chat",
        providers: {
          main: {
            backend: "openai_compatible",
            base_url: "https://api.openai.com/v1",
            api_key: "sk-secret",
          },
        },
        profiles: {
          chat: { chain: [{ provider: "main", model: "m" }] },
        },
      },
    } as never);
    const llm = out.llm as Record<string, unknown>;
    const providers = llm.providers as Record<string, Record<string, unknown>>;
    expect(providers.main?.api_key).toBe("sk-secret");
  });

  it("database.url 原样返回", () => {
    const out = sanitizeConfigForApi({
      database: { url: "postgresql://anima:secretpass@127.0.0.1:5432/anima" },
    } as never);
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
    } as never);
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
});
