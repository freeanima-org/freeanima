import { it, expect, beforeEach, afterEach } from "bun:test";
import { describePg } from "../../helpers/pg-test-gate.ts";
import {
  beginIntegrationCaseWithConfig,
  restoreIntegrationHome,
} from "../../helpers/integration-case.ts";

import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  buildFileTree,
  readStudioFile,
  searchStudio,
  patchStudioConfig,
  getStudioConfig,
} from "@freeanima/platform/ports/studio-port";
import { resolveStudioPath } from "@freeanima/platform/runtime/studio";
import { getAppRuntime } from "@freeanima/platform";

describePg("studio", () => {
  let workspace: string;
  const prev = process.env.FREEANIMA_HOME;

  beforeEach(async () => {
    workspace = mkdtempSync(join(tmpdir(), "anima-ws-"));
    await beginIntegrationCaseWithConfig(
      "anima-studio-",
      `studio:
  workspace: ${JSON.stringify(workspace)}
  gitignore: true
  showHidden: false
`,
    );

    mkdirSync(join(workspace, "src"), { recursive: true });
    writeFileSync(join(workspace, "src", "main.ts"), "export const foo = 42\n", "utf-8");
    writeFileSync(join(workspace, "package.json"), '{"name":"demo"}\n', "utf-8");
    writeFileSync(join(workspace, ".gitignore"), "node_modules/\n", "utf-8");
  });

  afterEach(async () => {
    await restoreIntegrationHome(prev);
  });

  it("buildFileTree returns workspace files", () => {
    const { tree, workspace: ws } = buildFileTree() as {
      tree: Array<{ name: string; children?: Array<{ name: string }> }>;
      workspace: string;
    };
    expect(ws).toBe(workspace);
    const names = tree.map((n) => n.name);
    expect(names).toContain("src");
    expect(names).toContain("package.json");
    const src = tree.find((n) => n.name === "src");
    expect(src?.children?.some((c) => c.name === "main.ts")).toBe(true);
  });

  it("readStudioFile returns content and language", () => {
    const f = readStudioFile("src/main.ts") as { content: string; language: string; path: string };
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
    expect(() => resolveStudioPath(getAppRuntime().runtimeDeps(), "../../etc/passwd")).toThrow(
      /workspace/,
    );
  });

  it("patchStudioConfig updates workspace", () => {
    const other = mkdtempSync(join(tmpdir(), "anima-ws2-"));
    patchStudioConfig({ workspace: other });
    expect(getStudioConfig().workspace).toBe(other);
  });
});
