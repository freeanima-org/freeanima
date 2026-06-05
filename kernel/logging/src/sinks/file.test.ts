import { afterEach, describe, expect, it } from "bun:test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createFileSink } from "./file.ts";
import type { LogRecord } from "../types.ts";

describe("createFileSink", () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const dir of tempDirs.splice(0)) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  function tempLogPath(name = "app.log"): string {
    const dir = mkdtempSync(join(tmpdir(), "freeanima-logging-"));
    tempDirs.push(dir);
    return join(dir, name);
  }

  const sampleRecord: LogRecord = {
    level: "info",
    message: "boot complete",
    attributes: { component: "kernel", pid: 42 },
    timestamp: Date.parse("2026-06-03T00:00:00.000Z"),
  };

  it("默认 json 格式追加 JSONL 行", () => {
    const lines: Array<{ path: string; line: string }> = [];
    const sink = createFileSink({
      path: "/tmp/unused.log",
      append: (path, line) => lines.push({ path, line }),
    });
    sink.emit(sampleRecord);
    expect(lines).toHaveLength(1);
    expect(lines[0]?.path).toBe("/tmp/unused.log");
    const parsed = JSON.parse(lines[0]?.line ?? "{}") as {
      level: string;
      message: string;
      attributes: { component: string; pid: number };
    };
    expect(parsed.level).toBe("info");
    expect(parsed.message).toBe("boot complete");
    expect(parsed.attributes.component).toBe("kernel");
    expect(parsed.attributes.pid).toBe(42);
  });

  it("pretty 格式写入可读行", () => {
    const lines: string[] = [];
    const sink = createFileSink({
      path: "/tmp/unused.log",
      format: "pretty",
      append: (_path, line) => lines.push(line),
    });
    sink.emit(sampleRecord);
    expect(lines[0]).toContain("INFO");
    expect(lines[0]).toContain("[kernel]");
    expect(lines[0]).toContain("boot complete");
  });

  it("多次 emit 追加多行", () => {
    const lines: string[] = [];
    const sink = createFileSink({
      path: "/tmp/unused.log",
      append: (_path, line) => lines.push(line),
    });
    sink.emit({ ...sampleRecord, message: "first" });
    sink.emit({ ...sampleRecord, message: "second" });
    expect(lines).toHaveLength(2);
    expect(JSON.parse(lines[0] ?? "{}").message).toBe("first");
    expect(JSON.parse(lines[1] ?? "{}").message).toBe("second");
  });

  it("默认 append 写入文件并自动创建父目录", () => {
    const dir = mkdtempSync(join(tmpdir(), "freeanima-logging-"));
    tempDirs.push(dir);
    const path = join(dir, "nested", "logs", "app.log");
    const sink = createFileSink({ path });
    sink.emit(sampleRecord);
    sink.emit({ ...sampleRecord, message: "again" });
    const content = readFileSync(path, "utf8");
    const fileLines = content.trimEnd().split("\n");
    expect(fileLines).toHaveLength(2);
    expect(JSON.parse(fileLines[0] ?? "{}").message).toBe("boot complete");
    expect(JSON.parse(fileLines[1] ?? "{}").message).toBe("again");
  });

  it("mkdir: false 时父目录不存在则抛错", () => {
    const dir = mkdtempSync(join(tmpdir(), "freeanima-logging-"));
    tempDirs.push(dir);
    const path = join(dir, "missing", "parent", "app.log");
    const sink = createFileSink({ path, mkdir: false });
    expect(() => sink.emit(sampleRecord)).toThrow();
  });

  it("可与 createLogger 组合", async () => {
    const path = tempLogPath();
    const { createLogger } = await import("../index.ts");
    const { createFileSink: createSink } = await import("./file.ts");
    const logger = createLogger({
      level: "info",
      sinks: [createSink({ path })],
    });
    logger.with({ component: "test" }).info("via logger");
    const content = readFileSync(path, "utf8").trimEnd();
    const parsed = JSON.parse(content) as {
      message: string;
      attributes: { component: string };
    };
    expect(parsed.message).toBe("via logger");
    expect(parsed.attributes.component).toBe("test");
  });
});
