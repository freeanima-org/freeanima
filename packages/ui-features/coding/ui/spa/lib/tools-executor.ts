import {
  discoverProjectAgentContext,
  type ProjectAgentContextSnapshot,
} from "@freeanima/shared/coding/project-agent-context";

import {
  createPortalShellWorkspaceBackend,
  WorkspaceSandbox,
  type WorkspaceFsBackend,
} from "./workspace-fs.ts";
import { projectVfsFromSandbox } from "./workspace-vfs.ts";

function toolResult(value: unknown): string {
  return typeof value === "string" ? value : JSON.stringify(value);
}

function toolError(message: string): string {
  return JSON.stringify({ error: message });
}

export type CodingToolsExecutorOptions = {
  workspaceRoot: string;
  /** 测试注入；缺省走 portalShell */
  backend?: WorkspaceFsBackend;
};

export type TerminalLogEntry = {
  id: string;
  command: string;
  workdir: string;
  output: string;
  ok: boolean;
  at: number;
};

let active: CodingToolsExecutorOptions | null = null;

let terminalLogs: TerminalLogEntry[] = [];
const terminalListeners = new Set<(logs: readonly TerminalLogEntry[]) => void>();
let termSeq = 0;

function publishTerminal(): void {
  const snapshot = terminalLogs.slice();
  for (const cb of terminalListeners) cb(snapshot);
}

export function getTerminalLogs(): readonly TerminalLogEntry[] {
  return terminalLogs;
}

export function subscribeTerminalLogs(cb: (logs: readonly TerminalLogEntry[]) => void): () => void {
  terminalListeners.add(cb);
  cb(terminalLogs.slice());
  return () => {
    terminalListeners.delete(cb);
  };
}

export function clearTerminalLogs(): void {
  terminalLogs = [];
  publishTerminal();
}

function pushTerminalLog(entry: Omit<TerminalLogEntry, "id" | "at">): void {
  termSeq += 1;
  terminalLogs = [{ id: `term-${termSeq}`, at: Date.now(), ...entry }, ...terminalLogs].slice(
    0,
    100,
  );
  publishTerminal();
}

/** SPA / 测试：设置当前会话 workspace（一把本地手可服务多会话路径）。 */
export function setCodingWorkspace(opts: CodingToolsExecutorOptions | null): void {
  active = opts;
}

export function getCodingWorkspace(): CodingToolsExecutorOptions | null {
  return active;
}

function resolveSandbox(): WorkspaceSandbox | { error: string } {
  if (!active?.workspaceRoot?.trim()) {
    return { error: "未设置 workspace_root：请先在 Coding 窗选择工作区目录" };
  }
  const backend = active.backend ?? createPortalShellWorkspaceBackend();
  if (!backend) {
    return {
      error: "无 workspace FS backend：需 portalShell.workspaceFs（Rust IPC）或测试注入 backend",
    };
  }
  return new WorkspaceSandbox(active.workspaceRoot, backend);
}

export async function executeCodingTool(
  localName: string,
  args: Record<string, unknown>,
): Promise<string> {
  const sandbox = resolveSandbox();
  if ("error" in sandbox) return toolError(sandbox.error);

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
      if (!out.ok) {
        pushTerminalLog({
          command,
          workdir,
          output: out.error,
          ok: false,
        });
        return toolError(out.error);
      }
      pushTerminalLog({
        command,
        workdir,
        output: out.text,
        ok: true,
      });
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
    default:
      return toolError(`未知工具: ${localName}`);
  }
}
