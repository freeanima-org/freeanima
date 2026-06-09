import { ToolSetRegistry } from "@freeanima/engine-tool";
import { describe, it, expect, beforeAll, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";

import { registerCoreTools } from "@freeanima/capabilities-tools";
import { clearConfigCache } from "@freeanima/service-config";

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
    registerCoreTools(tools);
  });

  beforeEach(() => {
    home = mkdtempSync(join(tmpdir(), "anima-local-"));
    cwd = mkdtempSync(join(tmpdir(), "anima-cwd-"));
    process.env.FREEANIMA_HOME = home;
    writeFileSync(join(home, "config.yaml"), MIN_CONFIG, "utf-8");
    clearConfigCache();
    process.chdir(cwd);
  });

  afterEach(() => {
    if (prevHome === undefined) delete process.env.FREEANIMA_HOME;
    else process.env.FREEANIMA_HOME = prevHome;
  });

  it("registers core tools", () => {
    const names = new Set(tools.listTools().map((t) => t.name));
    for (const n of [
      "read_file",
      "write_file",
      "search_files",
      "patch",
      "list_credentials",
      "execute_code",
      "terminal",
      "process",
      "web_search",
      "web_extract",
    ]) {
      expect(names.has(n), n).toBe(true);
    }
  });

  it.skipIf(!hasRg)("search_files content mode", async () => {
    const p = join(cwd, "findme.ts");
    writeFileSync(p, "const needle = 1;\n", "utf-8");
    const out = await tools.getTool("search_files")!.handler({
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
    const out = await tools.getTool("search_files")!.handler({
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
    const out = await tools.getTool("search_files")!.handler({
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
    const out = await tools.getTool("search_files")!.handler({
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
    const out = await tools.getTool("search_files")!.handler({
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
    const out = await tools.getTool("search_files")!.handler({
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
    const out = await tools.getTool("terminal")!.handler({ command: "echo hello-anima" });
    expect(out).toContain("hello-anima");
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
