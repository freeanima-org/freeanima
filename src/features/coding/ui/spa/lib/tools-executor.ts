import {
  createPortalShellWorkspaceBackend,
  WorkspaceSandbox,
  type WorkspaceFsBackend,
} from "./workspace-fs.ts";

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

export type PendingPatch = {
  id: string;
  path: string;
  old_string: string;
  new_string: string;
  replace_all: boolean;
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
let pendingPatches: PendingPatch[] = [];
const pendingListeners = new Set<(patches: readonly PendingPatch[]) => void>();
let patchSeq = 0;

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

function publishPending(): void {
  const snapshot = pendingPatches.slice();
  for (const cb of pendingListeners) cb(snapshot);
}

/** SPA / 测试：设置当前会话 workspace（一把本地手可服务多会话路径）。 */
export function setCodingWorkspace(opts: CodingToolsExecutorOptions | null): void {
  active = opts;
}

export function getCodingWorkspace(): CodingToolsExecutorOptions | null {
  return active;
}

export function getPendingPatches(): readonly PendingPatch[] {
  return pendingPatches;
}

export function subscribePendingPatches(
  cb: (patches: readonly PendingPatch[]) => void,
): () => void {
  pendingListeners.add(cb);
  cb(pendingPatches.slice());
  return () => {
    pendingListeners.delete(cb);
  };
}

/** 测试 / 重置：清空待审 patch。 */
export function clearPendingPatches(): void {
  pendingPatches = [];
  publishPending();
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

/** 用户 Accept：真正写入磁盘。 */
export async function acceptPendingPatch(id: string): Promise<string> {
  const idx = pendingPatches.findIndex((p) => p.id === id);
  if (idx < 0) return toolError(`pending patch 不存在: ${id}`);
  const patch = pendingPatches[idx];
  if (!patch) return toolError(`pending patch 不存在: ${id}`);
  const sandbox = resolveSandbox();
  if ("error" in sandbox) return toolError(sandbox.error);
  const out = await sandbox.filePatch({
    path: patch.path,
    old_string: patch.old_string,
    new_string: patch.new_string,
    replace_all: patch.replace_all,
  });
  if (!out.ok) return toolError(out.error);
  pendingPatches = pendingPatches.filter((p) => p.id !== id);
  publishPending();
  return toolResult({ ok: true, path: out.path, applied: true });
}

/** Accept 前允许 UI 微调 old/new。 */
export async function acceptEditedPendingPatch(
  id: string,
  edits: { old_string: string; new_string: string },
): Promise<string> {
  const idx = pendingPatches.findIndex((p) => p.id === id);
  if (idx < 0) return toolError(`pending patch 不存在: ${id}`);
  const cur = pendingPatches[idx];
  if (!cur) return toolError(`pending patch 不存在: ${id}`);
  pendingPatches[idx] = {
    ...cur,
    old_string: edits.old_string,
    new_string: edits.new_string,
  };
  publishPending();
  return acceptPendingPatch(id);
}

export function rejectPendingPatch(id: string): boolean {
  const before = pendingPatches.length;
  pendingPatches = pendingPatches.filter((p) => p.id !== id);
  if (pendingPatches.length !== before) {
    publishPending();
    return true;
  }
  return false;
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
      // 无 dry_run：入队待用户 Accept，避免模型直接写盘
      const path = typeof args.path === "string" ? args.path : "";
      const old_string = typeof args.old_string === "string" ? args.old_string : "";
      const new_string = typeof args.new_string === "string" ? args.new_string : "";
      if (!path) return toolError("path 不能为空");
      if (!old_string) return toolError("old_string 不能为空");
      patchSeq += 1;
      const pending: PendingPatch = {
        id: `patch-${patchSeq}`,
        path,
        old_string,
        new_string,
        replace_all: Boolean(args.replace_all),
      };
      pendingPatches = [...pendingPatches, pending];
      publishPending();
      return toolResult({
        ok: true,
        pending: true,
        patch_id: pending.id,
        path,
        message: "awaiting user Accept in Coding Diff 审阅",
      });
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
    default:
      return toolError(`未知工具: ${localName}`);
  }
}
