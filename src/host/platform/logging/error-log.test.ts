import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { createLogger } from "@freeanima/host/kernel/logging";
import { createMemorySink } from "@freeanima/host/kernel/logging/sinks/memory.ts";
import type { MemorySink } from "@freeanima/host/kernel/logging/sinks/memory.ts";
import { logComponent, logStartupError, resetServiceLogger, setServiceLogger } from "./index.ts";

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

    const messages = memory.records.map((r) => r.message).join("\n");
    expect(messages).toContain("test message");
  });

  it("writes startup failure with source tag", () => {
    logStartupError("service startup failed", new Error("database.url not configured"));

    expect(memory.records.some((r) => r.message.includes("service startup failed"))).toBe(true);
    expect(
      memory.records.some(
        (r) =>
          r.attributes.component === "startup" &&
          String(r.attributes.err ?? "").includes("database.url not configured"),
      ),
    ).toBe(true);
  });
});
