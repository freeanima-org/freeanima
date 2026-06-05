import { describe, expect, it, spyOn } from "bun:test";
import { createConsoleSink } from "./console.ts";
import type { LogRecord } from "../types.ts";

describe("createConsoleSink", () => {
  it("pretty 格式包含 level、component 与 attributes suffix", () => {
    const lines: string[] = [];
    const sink = createConsoleSink({
      format: "pretty",
      write: (line: string) => lines.push(line),
    });
    const record: LogRecord = {
      level: "error",
      message: "login failed",
      attributes: { component: "gateway.discord", err: new Error("boom"), status: 503 },
      timestamp: Date.parse("2026-06-03T00:00:00.000Z"),
    };
    sink.emit(record);
    expect(lines).toHaveLength(1);
    const line = lines[0] ?? "";
    expect(line).toContain("2026-06-03T00:00:00.000Z");
    expect(line).toContain("ERROR");
    expect(line).toContain("[gateway.discord]");
    expect(line).toContain("login failed");
    expect(line).toContain("boom");
    expect(line).toContain("503");
  });

  it("pretty 无 component 时不输出方括号前缀", () => {
    const lines: string[] = [];
    const sink = createConsoleSink({
      write: (line: string) => lines.push(line),
    });
    sink.emit({
      level: "info",
      message: "boot",
      attributes: {},
      timestamp: 0,
    });
    expect(lines[0]).not.toContain("[");
    expect(lines[0]).toContain("INFO");
    expect(lines[0]).toContain("boot");
  });

  it("pretty 无额外 attributes 时不输出 JSON suffix", () => {
    const lines: string[] = [];
    const sink = createConsoleSink({
      write: (line: string) => lines.push(line),
    });
    sink.emit({
      level: "warn",
      message: "only message",
      attributes: { component: "kernel" },
      timestamp: 0,
    });
    expect(lines[0]).toContain("only message");
    expect(lines[0]?.endsWith("only message")).toBe(true);
  });

  it("pretty 非 string component 不输出方括号", () => {
    const lines: string[] = [];
    const sink = createConsoleSink({
      write: (line: string) => lines.push(line),
    });
    sink.emit({
      level: "info",
      message: "x",
      attributes: { component: 42 },
      timestamp: 0,
    });
    expect(lines[0]).not.toContain("[");
  });

  it("json 格式输出单行 JSON 并序列化 err", () => {
    const lines: string[] = [];
    const sink = createConsoleSink({
      format: "json",
      write: (line: string) => lines.push(line),
    });
    const err = new Error("fail");
    sink.emit({
      level: "info",
      message: "hello",
      attributes: { component: "kernel", err },
      timestamp: 1,
    });
    const parsed = JSON.parse(lines[0] ?? "{}") as {
      level: string;
      message: string;
      timestamp: number;
      attributes: {
        component: string;
        err: { message: string; name: string };
      };
    };
    expect(parsed.level).toBe("info");
    expect(parsed.message).toBe("hello");
    expect(parsed.timestamp).toBe(1);
    expect(parsed.attributes.component).toBe("kernel");
    expect(parsed.attributes.err.message).toBe("fail");
  });

  it("默认 write 走 console.error", () => {
    const spy = spyOn(console, "error").mockImplementation(() => {});
    const sink = createConsoleSink();
    sink.emit({
      level: "debug",
      message: "via console",
      attributes: {},
      timestamp: 0,
    });
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0]?.[0]).toContain("via console");
    spy.mockRestore();
  });

  it("默认 format 为 pretty", () => {
    const lines: string[] = [];
    const sink = createConsoleSink({ write: (line: string) => lines.push(line) });
    sink.emit({
      level: "info",
      message: "pretty default",
      attributes: {},
      timestamp: 0,
    });
    expect(lines[0]).toContain("INFO");
    expect(lines[0]).toContain("pretty default");
  });
});
