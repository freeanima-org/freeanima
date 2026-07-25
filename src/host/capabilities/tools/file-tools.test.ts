import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { createTempDir, removeTempDir } from "@freeanima/host/core/util/temp-dir";
import { Config } from "@freeanima/host/platform/config";
import { registerCoreTools } from "@freeanima/host/capabilities/tools";
import { ToolSetRegistry } from "@freeanima/host/core/tool";
import { parseYaml } from "@freeanima/host/platform/config";
import { runtimeConfigSchema } from "@freeanima/host/core/config";
import { MINIMAL_LLM_YAML } from "@freeanima/host/platform/config/test-helpers/minimal-llm-config";

function testConfig() {
  const parsed = runtimeConfigSchema.safeParse(parseYaml(MINIMAL_LLM_YAML));
  if (!parsed.success) throw new Error(parsed.error.message);
  return Config.fromSnapshot(parsed.data);
}

let toolSets: ToolSetRegistry;

describe("file tools", () => {
  let home: string;
  let cwd: string;
  const prevHome = process.env.FREEANIMA_HOME;

  beforeEach(() => {
    toolSets = new ToolSetRegistry();
    home = createTempDir("anima-tools-");
    cwd = createTempDir("anima-cwd-");
    process.env.FREEANIMA_HOME = home;
    registerCoreTools(toolSets, testConfig());
  });

  afterEach(() => {
    if (prevHome === undefined) delete process.env.FREEANIMA_HOME;
    else process.env.FREEANIMA_HOME = prevHome;
    removeTempDir(home);
    removeTempDir(cwd);
  });

  it("read_file returns line numbers", async () => {
    const p = join(cwd, "a.txt");
    writeFileSync(p, "a\nb\nc\n", "utf-8");
    const tool = toolSets.getTool("file_read")!;
    const out = await tool.handler({ path: p, offset: 1, limit: 2 });
    expect(out).toContain("1|a");
    expect(out).toContain("2|b");
  });

  it("write_file creates file", async () => {
    const target = join(cwd, "sub", "f.txt");
    const tool = toolSets.getTool("file_write")!;
    const out = await tool.handler({ path: target, content: "hello" });
    expect(out).toContain('"ok":true');
    expect(readFileSync(target, "utf-8")).toBe("hello");
  });

  it("patch replaces content on existing file", async () => {
    const p = join(cwd, "patch-me.txt");
    writeFileSync(p, "hello world\n", "utf-8");
    const tool = toolSets.getTool("file_patch")!;
    const out = await tool.handler({
      path: p,
      old_string: "world",
      new_string: "anima",
    });
    expect(out).toContain('"ok":true');
    expect(readFileSync(p, "utf-8")).toBe("hello anima\n");
  });

  it("patch works in nested directory path", async () => {
    const abs = join(cwd, "sub", "rel.txt");
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, "alpha\n", "utf-8");
    const out = await toolSets.getTool("file_patch")!.handler({
      path: abs,
      old_string: "alpha",
      new_string: "beta",
    });
    expect(out).toContain('"ok":true');
    expect(readFileSync(abs, "utf-8")).toBe("beta\n");
  });

  it("denies /etc read and write", async () => {
    const readOut = await toolSets.getTool("file_read")!.handler({ path: "/etc/passwd" });
    expect(readOut).toContain("blocked /etc path");
    const writeOut = await toolSets.getTool("file_write")!.handler({
      path: "/etc/hosts",
      content: "x",
    });
    expect(writeOut).toContain("blocked /etc path");
  });

  it("file_delete removes a file and denies /etc", async () => {
    const p = join(cwd, "to-delete.txt");
    writeFileSync(p, "bye", "utf-8");
    const out = await toolSets.getTool("file_delete")!.handler({ path: p });
    expect(out).toContain('"ok":true');
    expect(existsSync(p)).toBe(false);

    const deny = await toolSets.getTool("file_delete")!.handler({ path: "/etc/passwd" });
    expect(deny).toContain("blocked /etc path");
  });

  it("tools are registered", () => {
    const names = new Set(toolSets.listTools().map((t) => t.name));
    expect(names.has("file_read")).toBe(true);
    expect(names.has("file_delete")).toBe(true);
  });
});
