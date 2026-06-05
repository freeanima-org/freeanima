import { describe, expect, it } from "bun:test";
import { formatJsonRecord, formatPrettyRecord } from "./format-record.ts";
import type { LogRecord } from "./types.ts";

describe("format-record", () => {
  const record: LogRecord = {
    level: "error",
    message: "login failed",
    attributes: { component: "gateway", err: new Error("boom"), status: 503 },
    timestamp: Date.parse("2026-06-03T00:00:00.000Z"),
  };

  it("formatPrettyRecord 包含 level、component 与 attributes suffix", () => {
    const line = formatPrettyRecord(record);
    expect(line).toContain("2026-06-03T00:00:00.000Z");
    expect(line).toContain("ERROR");
    expect(line).toContain("[gateway]");
    expect(line).toContain("login failed");
    expect(line).toContain("boom");
    expect(line).toContain("503");
  });

  it("formatJsonRecord 输出单行 JSON 并序列化 err", () => {
    const parsed = JSON.parse(formatJsonRecord(record)) as {
      level: string;
      message: string;
      timestamp: number;
      attributes: {
        component: string;
        err: { message: string };
        status: number;
      };
    };
    expect(parsed.level).toBe("error");
    expect(parsed.message).toBe("login failed");
    expect(parsed.timestamp).toBe(record.timestamp);
    expect(parsed.attributes.component).toBe("gateway");
    expect(parsed.attributes.err.message).toBe("boom");
    expect(parsed.attributes.status).toBe(503);
  });
});
