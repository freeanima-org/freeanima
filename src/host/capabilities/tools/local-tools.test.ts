import { ToolSetRegistry } from "@freeanima/host/core/tool";
import {
  bindActiveRuntimeConfig,
  resetActiveConfigForTest,
  runtimeConfigSchema,
} from "@freeanima/host/core/config";
import { describe, it, expect, beforeAll, beforeEach, afterEach } from "bun:test";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { createTempDir, removeTempDir } from "@freeanima/host/core/util/temp-dir";

import { Config } from "@freeanima/host/platform/config";
import { registerCoreTools } from "@freeanima/host/capabilities/tools";
import { parseYaml } from "@freeanima/host/platform/config";

const MIN_CONFIG = `
llm:
  default_profile: chat
  providers:
    main:
      backend: openai_compatible
      base_url: https://api.openai.com/v1
      api_key: test-key
  profiles:
    chat:
      chain:
        - provider: main
          model: test-model
`;

const hasRg = spawnSync("rg", ["--version"], { encoding: "utf-8" }).status === 0;

const tools = new ToolSetRegistry();

describe("local tools", () => {
  let home: string;
  let cwd: string;
  const prevHome = process.env.FREEANIMA_HOME;

  beforeAll(() => {
    const parsed = runtimeConfigSchema.safeParse(parseYaml(MIN_CONFIG));
    if (!parsed.success) throw new Error(parsed.error.message);
    registerCoreTools(tools, Config.fromSnapshot(parsed.data));
  });

  beforeEach(() => {
    home = createTempDir("anima-local-");
    cwd = createTempDir("anima-cwd-");
    process.env.FREEANIMA_HOME = home;
    const parsed = runtimeConfigSchema.safeParse(parseYaml(MIN_CONFIG));
    if (!parsed.success) throw new Error(parsed.error.message);
    bindActiveRuntimeConfig(Config.fromSnapshot(parsed.data));
  });

  afterEach(() => {
    resetActiveConfigForTest();
    if (prevHome === undefined) delete process.env.FREEANIMA_HOME;
    else process.env.FREEANIMA_HOME = prevHome;
    removeTempDir(home);
    removeTempDir(cwd);
  });

  it("registers core tools", () => {
    const names = new Set(tools.listTools().map((t) => t.name));
    for (const n of [
      "file_read",
      "file_write",
      "file_search",
      "file_patch",
      "code_execute",
      "terminal_run",
      "terminal_process",
      "web_search",
      "web_extract",
    ]) {
      expect(names.has(n), n).toBe(true);
    }
  });

  it.skipIf(!hasRg)("search_files content mode", async () => {
    const p = join(cwd, "findme.ts");
    writeFileSync(p, "const needle = 1;\n", "utf-8");
    const out = await tools.getTool("file_search")!.handler({
      pattern: "needle",
      target: "content",
      path: cwd,
    });
    const data = JSON.parse(out);
    expect(data.matches?.length).toBeGreaterThan(0);
  });

  it("search_files files mode", async () => {
    writeFileSync(join(cwd, "a.py"), "x", "utf-8");
    writeFileSync(join(cwd, "b.txt"), "y", "utf-8");
    const out = await tools.getTool("file_search")!.handler({
      pattern: "*.py",
      target: "files",
      path: cwd,
    });
    const data = JSON.parse(out);
    expect(data.files?.some((f: string) => f.endsWith("a.py"))).toBe(true);
  });

  it("search_files files_only with glob pattern lists files", async () => {
    writeFileSync(join(cwd, "a.py"), "x", "utf-8");
    writeFileSync(join(cwd, "b.txt"), "y", "utf-8");
    const out = await tools.getTool("file_search")!.handler({
      pattern: "*",
      output_mode: "files_only",
      path: cwd,
    });
    const data = JSON.parse(out);
    expect(data.error).toBeUndefined();
    expect(data.files?.length).toBeGreaterThanOrEqual(2);
  });

  it.skipIf(!hasRg)("search_files content treats pattern as literal by default", async () => {
    writeFileSync(join(cwd, "sym.ts"), "export function fact_store(x: number) {}\n", "utf-8");
    const out = await tools.getTool("file_search")!.handler({
      pattern: "fact_store(",
      target: "content",
      path: cwd,
    });
    const data = JSON.parse(out);
    expect(data.error).toBeUndefined();
    expect(JSON.stringify(data)).toContain("fact_store");
  });

  it.skipIf(!hasRg)("search_files content regex mode", async () => {
    writeFileSync(join(cwd, "rx.ts"), "const fooBar = 1;\n", "utf-8");
    const out = await tools.getTool("file_search")!.handler({
      pattern: "foo.*Bar",
      target: "content",
      path: cwd,
      regex: true,
    });
    const data = JSON.parse(out);
    expect(data.error).toBeUndefined();
    expect(data.total_lines).toBeGreaterThan(0);
  });

  it("search_files glob alternation with pipe", async () => {
    writeFileSync(join(cwd, "index.html"), "h", "utf-8");
    writeFileSync(join(cwd, "app.js"), "j", "utf-8");
    writeFileSync(join(cwd, "readme.md"), "m", "utf-8");
    const out = await tools.getTool("file_search")!.handler({
      pattern: "*.html|*.js",
      target: "files",
      path: cwd,
    });
    const data = JSON.parse(out);
    expect(data.files?.some((f: string) => f.endsWith("index.html"))).toBe(true);
    expect(data.files?.some((f: string) => f.endsWith("app.js"))).toBe(true);
    expect(data.files?.some((f: string) => f.endsWith("readme.md"))).toBe(false);
  });

  it("terminal runs echo", async () => {
    const out = await tools.getTool("terminal_run")!.handler({
      command: "echo hello-anima",
      shell: true,
      workdir: cwd,
    });
    expect(out).toContain("hello-anima");
  });

  it("terminal oversized output spills artifact_path", async () => {
    const { TOOL_OUTPUT_PREVIEW_MAX } = await import("@freeanima/host/core/tool");
    const bigPath = join(cwd, "big-out.txt");
    writeFileSync(bigPath, "y".repeat(TOOL_OUTPUT_PREVIEW_MAX + 80), "utf-8");
    writeFileSync(
      join(cwd, "print-big.mjs"),
      `import { readFileSync } from "node:fs";\nprocess.stdout.write(readFileSync(${JSON.stringify(bigPath)}, "utf8"));\n`,
    );
    const out = await tools.getTool("terminal_run")!.handler({
      command: "bun print-big.mjs",
      workdir: cwd,
    });
    expect(out).toContain("artifact_path:");
    expect(out).toContain("truncated: true");
    expect(out).toContain("file_read");
  });

  it("terminal blocks catastrophic rm; shell=true works without env gate", async () => {
    const rm = await tools.getTool("terminal_run")!.handler({
      command: "rm -rf /",
      workdir: cwd,
    });
    expect(rm).toContain("catastrophic");

    const shellOut = await tools.getTool("terminal_run")!.handler({
      command: "echo ok",
      shell: true,
      workdir: cwd,
    });
    expect(shellOut).toContain("ok");
  });

  it("web_search calls Firecrawl API", async () => {
    const origFetch = globalThis.fetch;
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({
          data: [{ title: "T", url: "https://example.com", description: "D" }],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      )) as unknown as typeof fetch;

    try {
      const out = await tools.getTool("web_search")!.handler({ query: "anima nest" });
      const data = JSON.parse(out);
      expect(data.results).toHaveLength(1);
      expect(data.results[0].url).toBe("https://example.com");
    } finally {
      globalThis.fetch = origFetch;
    }
  });
});
