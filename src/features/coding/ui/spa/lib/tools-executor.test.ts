import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  acceptPendingPatch,
  clearPendingPatches,
  clearTerminalLogs,
  executeCodingTool,
  getPendingPatches,
  getTerminalLogs,
  setCodingWorkspace,
} from "./tools-executor.ts";
import { createNodeWorkspaceBackend } from "./workspace-fs.node-backend.ts";
import { normalizeLexicalPath, resolveUnderWorkspace, WorkspaceSandbox } from "./workspace-fs.ts";
import { parseProjectJson, stableKeyFromGitRemote } from "./project-json.ts";

afterEach(() => {
  setCodingWorkspace(null);
  clearPendingPatches();
  clearTerminalLogs();
});

function tempWorkspace(): string {
  const root = mkdtempSync(join(tmpdir(), "coding-ws-"));
  mkdirSync(join(root, "src"), { recursive: true });
  writeFileSync(join(root, "src", "hello.ts"), " const x = 1;\nconst y = 2;\n", "utf-8");
  writeFileSync(join(root, "README.md"), "# demo\nhello world\n", "utf-8");
  mkdirSync(join(root, ".anima"), { recursive: true });
  writeFileSync(
    join(root, ".anima", "project.json"),
    JSON.stringify({ version: 1, stable_key: "git:github.com/org/demo", display_name: "Demo" }),
    "utf-8",
  );
  return root;
}

describe("resolveUnderWorkspace", () => {
  test("阻止 .. 逃逸", () => {
    const r = resolveUnderWorkspace("/tmp/ws", "../outside");
    expect(r.ok).toBe(false);
  });

  test("相对路径落在 root 下", () => {
    const r = resolveUnderWorkspace("/tmp/ws", "src/a.ts");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.rel).toBe("src/a.ts");
      expect(r.abs).toBe("/tmp/ws/src/a.ts");
    }
  });

  test("normalizeLexicalPath 折叠 ..", () => {
    expect(normalizeLexicalPath("/tmp/ws/a/../b")).toBe("/tmp/ws/b");
  });
});

describe("project-json", () => {
  test("stableKeyFromGitRemote", () => {
    expect(stableKeyFromGitRemote("git@github.com:org/foo.git")).toBe("git:github.com/org/foo");
    expect(stableKeyFromGitRemote("https://github.com/org/foo.git")).toBe("git:github.com/org/foo");
  });

  test("parseProjectJson", () => {
    const p = parseProjectJson(
      JSON.stringify({ version: 1, stable_key: "git:github.com/org/demo", display_name: "Demo" }),
    );
    expect(p?.stable_key).toBe("git:github.com/org/demo");
    expect(p?.display_name).toBe("Demo");
  });
});

describe("executeCodingTool → workspace sandbox", () => {
  test("file_list / file_read / file_search / file_patch", async () => {
    const root = tempWorkspace();
    const backend = createNodeWorkspaceBackend();
    setCodingWorkspace({ workspaceRoot: root, backend });

    const listRaw = await executeCodingTool("file_list", { path: ".", max_depth: 2 });
    const list = JSON.parse(listRaw) as { ok: boolean; entries: Array<{ path: string }> };
    expect(list.ok).toBe(true);
    expect(list.entries.some((e) => e.path === "README.md")).toBe(true);

    const read = await executeCodingTool("file_read", { path: "README.md", limit: 10 });
    expect(read).toContain("1|# demo");

    const search = await executeCodingTool("file_search", {
      pattern: "hello",
      output_mode: "files_only",
    });
    expect(search).toContain("README.md");

    const patchRaw = await executeCodingTool("file_patch", {
      path: "README.md",
      old_string: "hello world",
      new_string: "hello coding",
    });
    const queued = JSON.parse(patchRaw) as { ok: boolean; pending: boolean; patch_id: string };
    expect(queued.ok).toBe(true);
    expect(queued.pending).toBe(true);
    expect(getPendingPatches()).toHaveLength(1);

    const appliedRaw = await acceptPendingPatch(queued.patch_id);
    expect(JSON.parse(appliedRaw)).toEqual({
      ok: true,
      path: "README.md",
      applied: true,
    });
    const sandbox = new WorkspaceSandbox(root, backend);
    const reread = await sandbox.fileRead({ path: "README.md" });
    expect(reread.ok && reread.text.includes("hello coding")).toBe(true);
  });

  test("未设置 workspace 时返回错误", async () => {
    const raw = await executeCodingTool("file_list", {});
    expect(JSON.parse(raw).error).toMatch(/workspace_root/);
  });

  test("path 逃逸被拒绝", async () => {
    const root = tempWorkspace();
    setCodingWorkspace({ workspaceRoot: root, backend: createNodeWorkspaceBackend() });
    const raw = await executeCodingTool("file_read", { path: "../outside.txt" });
    expect(JSON.parse(raw).error).toMatch(/escapes/);
  });

  test("terminal_run 写入日志面板数据", async () => {
    const root = tempWorkspace();
    setCodingWorkspace({ workspaceRoot: root, backend: createNodeWorkspaceBackend() });
    const out = await executeCodingTool("terminal_run", {
      command: "echo coding-term",
      shell: true,
    });
    expect(out).toContain("coding-term");
    const logs = getTerminalLogs();
    expect(logs.length).toBeGreaterThanOrEqual(1);
    expect(logs[0]!.command).toContain("echo");
    expect(logs[0]!.ok).toBe(true);
  });
});
