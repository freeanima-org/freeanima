import { describe, it, expect, beforeEach, afterEach, afterAll } from "vitest";
import { describePg } from "../../helpers/pg-test-gate.ts";
import {
  beginIntegrationCaseWithConfig,
} from "../../helpers/integration-case.ts";
import { endIntegrationCase } from "../../helpers/integration-case.ts";

import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  buildFileTree,
  readStudioFile,
  searchStudio,
  resolveStudioPath,
  patchStudioConfig,
  getStudioConfig,
  parseGitignore,
  isIgnored,
} from "@freeanima/legacy-runtime";
import { clearConfigCache } from "@freeanima/legacy-kernel";

describePg("studio", () => {
  let home: string;
  let workspace: string;
  const prev = process.env.FREEANIMA_HOME;

  beforeEach(async () => {
    workspace = mkdtempSync(join(tmpdir(), "anima-ws-"));
    const ctx = await beginIntegrationCaseWithConfig(
      "anima-studio-",
      `studio:
  workspace: ${JSON.stringify(workspace)}
  gitignore: true
  showHidden: false
`,
    );
    home = ctx.home;

    mkdirSync(join(workspace, "src"), { recursive: true });
    writeFileSync(join(workspace, "src", "main.ts"), "export const foo = 42\n", "utf-8");
    writeFileSync(join(workspace, "package.json"), '{"name":"demo"}\n', "utf-8");
    writeFileSync(join(workspace, ".gitignore"), "node_modules/\n", "utf-8");
  });

  afterEach(async () => {
    if (prev === undefined) delete process.env.FREEANIMA_HOME;
    else process.env.FREEANIMA_HOME = prev;
  });

  it("buildFileTree returns workspace files", () => {
    const { tree, workspace: ws } = buildFileTree();
    expect(ws).toBe(workspace);
    const names = tree.map((n) => n.name);
    expect(names).toContain("src");
    expect(names).toContain("package.json");
    const src = tree.find((n) => n.name === "src");
    expect(src?.children?.some((c) => c.name === "main.ts")).toBe(true);
  });

  it("readStudioFile returns content and language", () => {
    const f = readStudioFile("src/main.ts");
    expect(f.content).toContain("foo");
    expect(f.language).toBe("typescript");
    expect(f.path).toBe("src/main.ts");
  });

  it("searchStudio finds text in files", () => {
    const { results } = searchStudio("foo");
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]!.file).toContain("main.ts");
  });

  it("resolveStudioPath rejects path traversal", () => {
    expect(() => resolveStudioPath("../../etc/passwd")).toThrow(/workspace/);
  });

  it("patchStudioConfig updates workspace", () => {
    const other = mkdtempSync(join(tmpdir(), "anima-ws2-"));
    patchStudioConfig({ workspace: other });
    clearConfigCache();
    expect(getStudioConfig().workspace).toBe(other);
  });
});

describePg("studio-gitignore", () => {
  it("parseGitignore handles negation and dir-only", () => {
    const rules = parseGitignore("*.log\n!important.log\nbuild/\n");
    expect(rules).toHaveLength(3);
    expect(isIgnored("debug.log", false, [rules])).toBe(true);
    expect(isIgnored("important.log", false, [rules])).toBe(false);
    expect(isIgnored("build", true, [rules])).toBe(true);
    expect(isIgnored("build/app.js", false, [rules])).toBe(false);
  });

  it("root-anchored /tmp/cursor-* does not ignore apps", () => {
    const rules = parseGitignore("/tmp/cursor-*/\n");
    expect(isIgnored("apps", true, [rules])).toBe(false);
    expect(isIgnored("packages", true, [rules])).toBe(false);
    expect(isIgnored("tmp/cursor-foo", true, [rules])).toBe(true);
  });

  afterAll(async () => {
    await endIntegrationCase();
  });
});
