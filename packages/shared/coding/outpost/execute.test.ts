import { describe, expect, test } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  CODING_BASE_TOOLS,
  createNodeWorkspaceBackend,
  executeCodingOutpostTool,
} from "./index.ts";

describe("coding outpost shared", () => {
  test("CODING_BASE_TOOLS 含核心工具", () => {
    const names = new Set(CODING_BASE_TOOLS.map((t) => t.local_name));
    expect(names.has("file_read")).toBe(true);
    expect(names.has("file_patch")).toBe(true);
    expect(names.has("terminal_run")).toBe(true);
    expect(names.has("project_mcp_status")).toBe(true);
  });

  test("executeCodingOutpostTool file_read / terminal_run", async () => {
    const root = mkdtempSync(join(tmpdir(), "anima-probe-"));
    writeFileSync(join(root, "hi.txt"), "hello\n", "utf-8");
    const backend = createNodeWorkspaceBackend();
    const text = await executeCodingOutpostTool(
      "file_read",
      { path: "hi.txt" },
      { workspaceRoot: root, backend },
    );
    expect(text).toContain("hello");
    const out = await executeCodingOutpostTool(
      "terminal_run",
      { command: 'echo "ok probe"', shell: false },
      { workspaceRoot: root, backend },
    );
    expect(out).toContain("ok probe");
  });
});
