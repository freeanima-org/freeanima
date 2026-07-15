import { describe, expect, it } from "bun:test";
import {
  isBootstrapConfigKey,
  isBootstrapWebHostingEnabled,
  pickBootstrapRecord,
  pickRuntimeDocument,
  type BootstrapConfig,
} from "@freeanima/core/config";

describe("bootstrap-config", () => {
  it("pickBootstrapRecord 仅保留 database/http/redis/web", () => {
    const raw = {
      database: { url: "postgresql://localhost/db" },
      http: { host: "127.0.0.1" },
      redis: { url: "redis://127.0.0.1" },
      web: { enabled: true },
      llm: { default_profile: "chat" },
    };
    expect(pickBootstrapRecord(raw)).toEqual({
      database: { url: "postgresql://localhost/db" },
      http: { host: "127.0.0.1" },
      redis: { url: "redis://127.0.0.1" },
      web: { enabled: true },
    });
  });

  it("pickRuntimeDocument 排除 bootstrap 键（含 web）", () => {
    const raw = {
      database: { url: "postgresql://localhost/db" },
      web: { enabled: true },
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
    expect(isBootstrapConfigKey("web")).toBe(true);
    expect(isBootstrapConfigKey("llm")).toBe(false);
  });

  it("isBootstrapWebHostingEnabled 缺省为 true", () => {
    expect(isBootstrapWebHostingEnabled({} as BootstrapConfig)).toBe(true);
    expect(isBootstrapWebHostingEnabled({ web: { enabled: false } } as BootstrapConfig)).toBe(
      false,
    );
    expect(isBootstrapWebHostingEnabled({ web: { enabled: true } } as BootstrapConfig)).toBe(true);
  });
});
