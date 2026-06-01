import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("error-log", () => {
  let home: string;
  const prev = process.env.FREEANIMA_HOME;

  beforeEach(() => {
    home = mkdtempSync(join(tmpdir(), "freeanima-errlog-"));
    process.env.FREEANIMA_HOME = home;
  });

  afterEach(() => {
    if (prev === undefined) delete process.env.FREEANIMA_HOME;
    else process.env.FREEANIMA_HOME = prev;
  });

  it("writes to error.log under home", async () => {
    const { logError, logApiError, PATHS } = await import("@freeanima/core");
    logError("test message", { source: "test" });
    logApiError("POST", "/api/sessions/x/messages/stream", 503, "LLM failed", {
      session_id: "x",
    });

    expect(existsSync(PATHS.errorLog)).toBe(true);
    const text = readFileSync(PATHS.errorLog, "utf-8");
    expect(text).toContain("test message");
    expect(text).toContain("API POST");
    expect(text).toContain("LLM failed");
  });

  it("writes startup failure with source tag", async () => {
    const { logStartupError, PATHS } = await import("@freeanima/core");
    logStartupError("服务启动失败", new Error("database.url 未配置"));

    const text = readFileSync(PATHS.errorLog, "utf-8");
    expect(text).toContain("[startup]");
    expect(text).toContain("服务启动失败");
    expect(text).toContain("database.url 未配置");
  });
});
