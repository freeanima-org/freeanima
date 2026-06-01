import { getTool, listTools } from "@freeanima/kernel";
import { describe, it, expect, beforeAll, beforeEach, afterEach } from "vitest";
import {
  mkdtempSync,
  writeFileSync,
  mkdirSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";

import { registerAllTools } from "@freeanima/tools";

const hasRg = spawnSync("rg", ["--version"], { encoding: "utf-8" }).status === 0;

describe("local tools", () => {
  let home: string;
  let cwd: string;
  const prevHome = process.env.FREEANIMA_HOME;

  beforeAll(() => {
    registerAllTools();
  });

  beforeEach(() => {
    home = mkdtempSync(join(tmpdir(), "anima-local-"));
    cwd = mkdtempSync(join(tmpdir(), "anima-cwd-"));
    process.env.FREEANIMA_HOME = home;
    process.chdir(cwd);
  });

  afterEach(() => {
    if (prevHome === undefined) delete process.env.FREEANIMA_HOME;
    else process.env.FREEANIMA_HOME = prevHome;
  });

  it("registers restored tools", () => {
    const names = new Set(listTools().map((t) => t.name));
    for (const n of [
      "search_files",
      "terminal",
      "web_search",
      "web_extract",
      "clarify",
      "recall",
      "remember",
      "process",
    ]) {
      expect(names.has(n), n).toBe(true);
    }
  });

  it.skipIf(!hasRg)("search_files content mode", async () => {
    const p = join(cwd, "findme.ts");
    writeFileSync(p, "const needle = 1;\n", "utf-8");
    const out = await getTool("search_files")!.handler({
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
    const out = await getTool("search_files")!.handler({
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
    const out = await getTool("search_files")!.handler({
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
    const out = await getTool("search_files")!.handler({
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
    const out = await getTool("search_files")!.handler({
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
    const out = await getTool("search_files")!.handler({
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
    const out = await getTool("terminal")!.handler({ command: "echo hello-anima" });
    expect(out).toContain("hello-anima");
  });

  it("clarify required returns awaiting JSON", async () => {
    const out = await getTool("clarify")!.handler({
      items: [{ question: "选哪个？", choices: ["A", "B"] }],
      required: true,
    });
    const data = JSON.parse(out);
    expect(data.status).toBe("awaiting");
    expect(data.items).toHaveLength(1);
    expect(data.items[0].question).toBe("选哪个？");
  });

  it("clarify optional with defaults returns resolved", async () => {
    const out = await getTool("clarify")!.handler({
      items: [{ question: "风格？", default: "简洁" }],
      required: false,
    });
    const data = JSON.parse(out);
    expect(data.status).toBe("resolved");
    expect(data.answers[0].answer).toBe("简洁");
  });

  it("clarify backward compatible single question", async () => {
    const out = await getTool("clarify")!.handler({ question: "test?" });
    const data = JSON.parse(out);
    expect(data.status).toBe("awaiting");
    expect(data.items[0].question).toBe("test?");
  });

  it("web_search calls Firecrawl API", async () => {
    const origFetch = globalThis.fetch;
    globalThis.fetch = async () =>
      new Response(
        JSON.stringify({
          data: [{ title: "T", url: "https://example.com", description: "D" }],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );

    try {
      const out = await getTool("web_search")!.handler({ query: "anima nest" });
      const data = JSON.parse(out);
      expect(data.results).toHaveLength(1);
      expect(data.results[0].url).toBe("https://example.com");
    } finally {
      globalThis.fetch = origFetch;
    }
  });
});
