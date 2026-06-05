import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { readFileSync, existsSync } from "node:fs";
import { logApiError, logError, logStartupError } from "@freeanima/service-logging";
import { PATHS } from "@freeanima/service-config";
import { beginLogIsolation, endLogIsolation } from "../../../../tests/helpers/log-isolation.ts";

describe("error-log", () => {
  const prev = process.env.FREEANIMA_HOME;

  beforeEach(() => {
    beginLogIsolation("freeanima-errlog-");
  });

  afterEach(() => {
    endLogIsolation(prev);
  });

  it("writes to error.log under home", () => {
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

  it("writes startup failure with source tag", () => {
    logStartupError("服务启动失败", new Error("database.url 未配置"));

    const text = readFileSync(PATHS.errorLog, "utf-8");
    expect(text).toContain("startup");
    expect(text).toContain("服务启动失败");
    expect(text).toContain("database.url 未配置");
  });
});
