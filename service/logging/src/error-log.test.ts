import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { createLogger } from "@freeanima/kernel-logging";
import { createMemorySink } from "@freeanima/kernel-logging/memory";
import type { MemorySink } from "@freeanima/kernel-logging/memory";
import {
  logApiError,
  logComponent,
  logStartupError,
  resetServiceLogger,
  setServiceLogger,
} from "./index.ts";

describe("error-log", () => {
  let memory: MemorySink;

  beforeEach(() => {
    memory = createMemorySink();
    setServiceLogger(createLogger({ sinks: [memory] }));
  });

  afterEach(() => {
    resetServiceLogger();
  });

  it("writes errors to memory sink", () => {
    logComponent("test").error("test message", { source: "test" });
    logApiError("POST", "/api/sessions/x/messages/stream", 503, "LLM failed", {
      session_id: "x",
    });

    const messages = memory.records.map((r) => r.message).join("\n");
    expect(messages).toContain("test message");
    expect(messages).toContain("API POST");
    expect(messages).toContain("LLM failed");
  });

  it("writes startup failure with source tag", () => {
    logStartupError("服务启动失败", new Error("database.url 未配置"));

    expect(memory.records.some((r) => r.message.includes("服务启动失败"))).toBe(true);
    expect(
      memory.records.some(
        (r) =>
          r.attributes.component === "startup" &&
          String(r.attributes.err ?? "").includes("database.url 未配置"),
      ),
    ).toBe(true);
  });
});
