import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { expandConfigEnv } from "../../src/env-expand.ts";

describe("expandConfigEnv", () => {
  const prev: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const key of ["PG_PASSWORD", "OPENAI_API_KEY", "EMPTY_VAR"]) {
      prev[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const [key, value] of Object.entries(prev)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it("expands ${VAR} from process.env", () => {
    process.env.PG_PASSWORD = "secret";
    const raw = "url: postgresql://u:${PG_PASSWORD}@host/db";
    expect(expandConfigEnv(raw)).toBe("url: postgresql://u:secret@host/db");
  });

  it("uses ${VAR:-default} when unset", () => {
    const raw = "host: ${REDIS_HOST:-127.0.0.1}";
    expect(expandConfigEnv(raw)).toBe("host: 127.0.0.1");
  });

  it("prefers env over default", () => {
    process.env.REDIS_HOST = "redis";
    const raw = "host: ${REDIS_HOST:-127.0.0.1}";
    expect(expandConfigEnv(raw)).toBe("host: redis");
  });

  it("replaces unset var without default as empty", () => {
    const raw = "key: ${MISSING_VAR}";
    expect(expandConfigEnv(raw)).toBe("key: ");
  });

  it("leaves non-placeholder text unchanged", () => {
    const raw = "model: deepseek-v4\n# not ${in comment}";
    expect(expandConfigEnv(raw)).toBe(raw);
  });
});
