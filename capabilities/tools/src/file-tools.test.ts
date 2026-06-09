import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { chdir } from "node:process";
import { registerCoreTools } from "@freeanima/capabilities-tools";
import { ToolRegistry } from "@freeanima/engine-tool";

const tools = new ToolRegistry();

describe("file tools", () => {
  let home: string;
  let cwd: string;
  const prevHome = process.env.FREEANIMA_HOME;

  beforeEach(() => {
    home = mkdtempSync(join(tmpdir(), "anima-tools-"));
    cwd = mkdtempSync(join(tmpdir(), "anima-cwd-"));
    process.env.FREEANIMA_HOME = home;
    chdir(cwd);
    registerCoreTools(tools);
  });

  afterEach(() => {
    if (prevHome === undefined) delete process.env.FREEANIMA_HOME;
    else process.env.FREEANIMA_HOME = prevHome;
  });

  it("read_file returns line numbers", async () => {
    const p = join(cwd, "a.txt");
    writeFileSync(p, "a\nb\nc\n", "utf-8");
    const tool = tools.get("read_file")!;
    const out = await tool.handler({ path: p, offset: 1, limit: 2 });
    expect(out).toContain("1|a");
    expect(out).toContain("2|b");
  });

  it("write_file creates file", async () => {
    const target = join(cwd, "sub", "f.txt");
    const tool = tools.get("write_file")!;
    const out = await tool.handler({ path: target, content: "hello" });
    expect(out).toContain('"ok":true');
    expect(readFileSync(target, "utf-8")).toBe("hello");
  });

  it("patch replaces content on existing file", async () => {
    const p = join(cwd, "patch-me.txt");
    writeFileSync(p, "hello world\n", "utf-8");
    const tool = tools.get("patch")!;
    const out = await tool.handler({
      path: p,
      old_string: "world",
      new_string: "anima",
    });
    expect(out).toContain('"ok":true');
    expect(readFileSync(p, "utf-8")).toBe("hello anima\n");
  });

  it("patch works with relative path after write_file", async () => {
    const rel = join("sub", "rel.txt");
    const abs = join(cwd, rel);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, "alpha\n", "utf-8");
    const out = await tools.get("patch")!.handler({
      path: rel,
      old_string: "alpha",
      new_string: "beta",
    });
    expect(out).not.toContain("invalid path");
    expect(readFileSync(abs, "utf-8")).toBe("beta\n");
  });

  it("tools are registered", () => {
    const names = new Set(tools.list().map((t) => t.name));
    expect(names.has("read_file")).toBe(true);
    expect(names.has("list_credentials")).toBe(true);
  });
});
