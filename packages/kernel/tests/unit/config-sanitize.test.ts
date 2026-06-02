import { describe, it, expect } from "bun:test";
import { sanitizeConfigForApi } from "../../src/config-sanitize.js";

describe("sanitizeConfigForApi", () => {
  it("脱敏顶层 api_key", () => {
    const out = sanitizeConfigForApi({ api_key: "sk-secret", model: "test" });
    expect(out.api_key).toBe("***");
    expect(out.model).toBe("test");
  });

  it("脱敏 database.url 中的密码", () => {
    const out = sanitizeConfigForApi({
      database: { url: "postgresql://anima:secretpass@127.0.0.1:5432/anima" },
    });
    expect(out.database).toEqual({
      url: "postgresql://***:***@127.0.0.1:5432/anima",
    });
  });

  it("脱敏 push.pushdeer.pushkey", () => {
    const out = sanitizeConfigForApi({
      push: {
        provider: "pushdeer",
        pushdeer: { pushkey: "real-key", api_base: "https://api2.pushdeer.com" },
      },
    });
    expect(out.push).toEqual({
      provider: "pushdeer",
      pushdeer: { pushkey: "***", api_base: "https://api2.pushdeer.com" },
    });
  });

  it("MCP env 仅保留 env_keys", () => {
    const out = sanitizeConfigForApi({
      mcp_servers: {
        db: {
          command: "node",
          transport: "stdio",
          env: { SECRET: "hidden", OTHER: "x" },
        },
      },
    });
    expect(out.mcp_servers).toEqual({
      db: {
        command: "node",
        transport: "stdio",
        env_keys: ["SECRET", "OTHER"],
      },
    });
  });
});
