import {
  discoverProjectAgentContext,
  type ProjectAgentContextSnapshot,
} from "@freeanima/shared/coding/project-agent-context";

import { projectVfsFromSandbox } from "./project-vfs.ts";
import { WorkspaceSandbox } from "./sandbox.ts";
import type { WorkspaceFsBackend } from "./types.ts";

function toolResult(value: unknown): string {
  return typeof value === "string" ? value : JSON.stringify(value);
}

function toolError(message: string): string {
  return JSON.stringify({ error: message });
}

export type ExecuteCodingToolOptions = {
  workspaceRoot: string;
  backend: WorkspaceFsBackend;
  /** 可选：project_mcp_status 返回值；缺省空列表 */
  projectMcpStatus?: () => Promise<unknown>;
};

/**
 * 执行 coding Outpost 本地工具（不含动态 mcp_*；由宿主桥接）。
 */
export async function executeCodingOutpostTool(
  localName: string,
  args: Record<string, unknown>,
  opts: ExecuteCodingToolOptions,
): Promise<string> {
  const root = opts.workspaceRoot.trim();
  if (!root) return toolError("未设置 workspace_root");

  const sandbox = new WorkspaceSandbox(root, opts.backend);

  switch (localName) {
    case "file_list": {
      const out = await sandbox.fileList({
        path: typeof args.path === "string" ? args.path : ".",
        maxDepth: typeof args.max_depth === "number" ? args.max_depth : 3,
        maxEntries: typeof args.limit === "number" ? args.limit : 500,
      });
      if (!out.ok) return toolError(out.error);
      return toolResult({ ok: true, entries: out.entries });
    }
    case "file_read": {
      const path = typeof args.path === "string" ? args.path : "";
      if (!path) return toolError("path 不能为空");
      const out = await sandbox.fileRead({
        path,
        offset: typeof args.offset === "number" ? args.offset : 1,
        limit: typeof args.limit === "number" ? args.limit : 500,
      });
      if (!out.ok) return toolError(out.error);
      return out.text;
    }
    case "file_search": {
      const pattern = typeof args.pattern === "string" ? args.pattern : "";
      const out = await sandbox.fileSearch({
        pattern,
        path: typeof args.path === "string" ? args.path : ".",
        limit: typeof args.limit === "number" ? args.limit : 50,
        output_mode:
          args.output_mode === "files_only" || args.output_mode === "count"
            ? args.output_mode
            : "content",
      });
      if (!out.ok) return toolError(out.error);
      return out.result;
    }
    case "file_patch": {
      const path = typeof args.path === "string" ? args.path : "";
      const old_string = typeof args.old_string === "string" ? args.old_string : "";
      const new_string = typeof args.new_string === "string" ? args.new_string : "";
      if (!path) return toolError("path 不能为空");
      if (!old_string) return toolError("old_string 不能为空");
      const out = await sandbox.filePatch({
        path,
        old_string,
        new_string,
        replace_all: Boolean(args.replace_all),
      });
      if (!out.ok) return toolError(out.error);
      return toolResult({ ok: true, path: out.path, applied: true });
    }
    case "terminal_run": {
      const command = typeof args.command === "string" ? args.command : "";
      const workdir = typeof args.workdir === "string" ? args.workdir : ".";
      const out = await sandbox.terminalRun({
        command,
        timeout: typeof args.timeout === "number" ? args.timeout : 180,
        workdir,
        shell: Boolean(args.shell),
      });
      if (!out.ok) return toolError(out.error);
      return out.text;
    }
    case "project_context": {
      const vfs = projectVfsFromSandbox(sandbox);
      const ctx = await discoverProjectAgentContext(vfs);
      const snapshot: ProjectAgentContextSnapshot = {
        ...ctx,
        discovered_at: new Date().toISOString(),
        workspace_root: sandbox.workspaceRoot,
      };
      return toolResult(snapshot);
    }
    case "agents_md_write": {
      const content = typeof args.content === "string" ? args.content : "";
      if (!content.trim()) return toolError("content 不能为空");
      const out = await sandbox.writeTextRel("AGENTS.md", content);
      if (!out.ok) return toolError(out.error);
      return toolResult({ ok: true, path: "AGENTS.md", bytes: content.length });
    }
    case "agents_md_read": {
      const out = await sandbox.readTextRel("AGENTS.md");
      if (!out.ok) {
        if (out.error.includes("read failed") || out.error.includes("ENOENT")) {
          return toolResult({ ok: true, path: "AGENTS.md", content: "", missing: true });
        }
        return toolError(out.error);
      }
      return toolResult({ ok: true, path: "AGENTS.md", content: out.text, missing: false });
    }
    case "project_mcp_status": {
      if (opts.projectMcpStatus) {
        return toolResult(await opts.projectMcpStatus());
      }
      return toolResult({ ok: true, servers: [], note: "probe 首版未桥接项目 MCP" });
    }
    default:
      return toolError(`未知工具: ${localName}`);
  }
}
