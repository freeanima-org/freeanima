import { describe, expect, it } from "bun:test";

import {
  isRuntimeConfigSectionKey,
  parseRuntimeConfig,
  runtimeConfigSchema,
} from "./runtime-config.ts";

describe("isRuntimeConfigSectionKey", () => {
  it("识别已知运行时段", () => {
    expect(isRuntimeConfigSectionKey("gateway")).toBe(true);
    expect(isRuntimeConfigSectionKey("tts")).toBe(true);
    expect(isRuntimeConfigSectionKey("connections")).toBe(true);
    expect(isRuntimeConfigSectionKey("text_generate")).toBe(true);
    expect(isRuntimeConfigSectionKey("image_generate")).toBe(true);
    expect(isRuntimeConfigSectionKey("audio_generate")).toBe(true);
    expect(isRuntimeConfigSectionKey("video_generate")).toBe(true);
    expect(isRuntimeConfigSectionKey("embedding")).toBe(true);
    expect(isRuntimeConfigSectionKey("llm")).toBe(false);
    expect(isRuntimeConfigSectionKey("passive_recall")).toBe(true);
    expect(isRuntimeConfigSectionKey("semantic_clustering")).toBe(true);
    expect(isRuntimeConfigSectionKey("public")).toBe(true);
  });

  it("排除 bootstrap 与未知段", () => {
    expect(isRuntimeConfigSectionKey("database")).toBe(false);
    expect(isRuntimeConfigSectionKey("http")).toBe(false);
    expect(isRuntimeConfigSectionKey("no_such_section")).toBe(false);
  });
});

describe("runtimeConfigSchema", () => {
  it("接受运行时段", () => {
    const parsed = runtimeConfigSchema.safeParse({
      compression: { enabled: true },
      connections: {},
      text_generate: { main: { connection: "p", model: "m" } },
    });
    expect(parsed.success).toBe(true);
  });

  it("parseRuntimeConfig 剥离 bootstrap 键", () => {
    const next = parseRuntimeConfig({
      database: { url: "postgres://x" },
      http: { host: "0.0.0.0" },
      redis: { url: "redis://x" },
      compression: { enabled: false },
    });
    expect(next.compression).toEqual({ enabled: false });
    expect((next as Record<string, unknown>).database).toBeUndefined();
    expect((next as Record<string, unknown>).http).toBeUndefined();
    expect((next as Record<string, unknown>).redis).toBeUndefined();
  });
});
