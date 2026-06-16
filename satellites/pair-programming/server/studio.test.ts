import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("pair-programming studio", () => {
  let workspace: string;
  const prevWorkspace = process.env.STUDIO_WORKSPACE;
  const prevShowHidden = process.env.STUDIO_SHOW_HIDDEN;

  beforeEach(async () => {
    workspace = mkdtempSync(join(tmpdir(), "pp-ws-"));
    mkdirSync(join(workspace, "src"), { recursive: true });
    writeFileSync(join(workspace, "src", "main.ts"), "export const foo = 42\n", "utf-8");
    process.env.STUDIO_WORKSPACE = workspace;
    delete process.env.STUDIO_SHOW_HIDDEN;
  });

  afterEach(() => {
    if (prevWorkspace === undefined) delete process.env.STUDIO_WORKSPACE;
    else process.env.STUDIO_WORKSPACE = prevWorkspace;
    if (prevShowHidden === undefined) delete process.env.STUDIO_SHOW_HIDDEN;
    else process.env.STUDIO_SHOW_HIDDEN = prevShowHidden;
  });

  it("buildFileTree returns workspace files", async () => {
    const { buildFileTree } = await import("./studio.ts");
    const { tree, workspace: ws } = buildFileTree();
    expect(ws).toBe(workspace);
    expect(tree.map((n) => n.name)).toContain("src");
  });

  it("readStudioFile returns content", async () => {
    const { readStudioFile } = await import("./studio.ts");
    const f = readStudioFile("src/main.ts");
    expect(f.content).toContain("foo");
    expect(f.path).toBe("src/main.ts");
  });

  it("searchStudio finds text", async () => {
    const { searchStudio } = await import("./studio.ts");
    const { results } = searchStudio("foo");
    expect(results.length).toBeGreaterThan(0);
  });

  it("executeLocalTool supports file_search and terminal_run", async () => {
    const { executeLocalTool } = await import("./tools/executor.ts");
    const searchOut = await executeLocalTool("file_search", { query: "foo" }, workspace);
    expect(JSON.parse(searchOut).count).toBeGreaterThan(0);
    const termOut = await executeLocalTool(
      "terminal_run",
      { command: "echo relay_ok", timeout: 5 },
      workspace,
    );
    expect(termOut).toContain("relay_ok");
  });
});
