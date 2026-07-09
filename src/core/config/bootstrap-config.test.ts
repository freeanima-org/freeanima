import { describe, expect, it } from "bun:test";
import {
  isBootstrapConfigKey,
  pickBootstrapRecord,
  pickRuntimeDocument,
} from "@freeanima/core/config";

describe("bootstrap-config", () => {
  it("pickBootstrapRecord 仅保留 database/http/redis", () => {
    const raw = {
      database: { url: "postgresql://localhost/db" },
      http: { host: "127.0.0.1" },
      redis: { url: "redis://127.0.0.1" },
      llm: { default_profile: "chat" },
    };
    expect(pickBootstrapRecord(raw)).toEqual({
      database: { url: "postgresql://localhost/db" },
      http: { host: "127.0.0.1" },
      redis: { url: "redis://127.0.0.1" },
    });
  });

  it("pickRuntimeDocument 排除 bootstrap 键", () => {
    const raw = {
      database: { url: "postgresql://localhost/db" },
      llm: { default_profile: "chat" },
      compression: { enabled: true },
    };
    expect(pickRuntimeDocument(raw)).toEqual({
      llm: { default_profile: "chat" },
      compression: { enabled: true },
    });
  });

  it("isBootstrapConfigKey", () => {
    expect(isBootstrapConfigKey("database")).toBe(true);
    expect(isBootstrapConfigKey("llm")).toBe(false);
  });
});
