/**
 * Coding Outpost：workspace_root 沙箱 FS。
 * 路径策略可参考 host `path-policy`，但执行在本机 Outpost（WebView / Bun 测试 backend）。
 *
 * Rust IPC（portalShell.workspaceFs / runCommand）尚未落地时：
 * - 纯路径逻辑与工具编排可测
 * - WebView 内无 backend 则返回明确错误
 */

import type {
  ShellRunCommandOpts,
  ShellRunCommandResult,
  WorkspaceFsApi,
  WorkspaceFsDirEntry,
} from "@freeanima/client/portal-sdk/shell-api.ts";

export type WorkspacePathOk = { ok: true; abs: string; rel: string };
export type WorkspacePathErr = { ok: false; error: string };
export type WorkspacePathResult = WorkspacePathOk | WorkspacePathErr;

export type WorkspaceTreeEntry = {
  path: string;
  kind: "file" | "dir";
  size?: number;
};

export type WorkspaceFsBackend = WorkspaceFsApi & {
  runCommand?: (opts: ShellRunCommandOpts) => Promise<ShellRunCommandResult>;
};

const SKIP_DIR_NAMES = new Set(["node_modules", ".git"]);

export function asPosixPath(path: string): string {
  return path.replace(/\\/g, "/");
}

/** 词法规范化：折叠 `.` / `..`，不要求路径存在。 */
export function normalizeLexicalPath(path: string): string {
  const posix = asPosixPath(path);
  const isWinAbs = /^[A-Za-z]:\//.test(posix);
  const isUnixAbs = posix.startsWith("/");
  const parts = posix.split("/").filter((p) => p.length > 0 && p !== ".");
  const out: string[] = [];
  for (const part of parts) {
    if (part === "..") {
      if (out.length === 0) continue;
      // 保留 Windows 盘符段
      if (isWinAbs && out.length === 1 && /^[A-Za-z]:$/.test(out[0] ?? "")) continue;
      out.pop();
      continue;
    }
    out.push(part);
  }
  if (isWinAbs) {
    return out.join("/");
  }
  if (isUnixAbs) {
    return `/${out.join("/")}`;
  }
  return out.join("/");
}

function rootPrefix(rootPosix: string): string {
  return rootPosix.endsWith("/") ? rootPosix.slice(0, -1) : rootPosix;
}

/** 将相对/绝对输入解析到 workspace_root 下；逃逸则失败。 */
export function resolveUnderWorkspace(workspaceRoot: string, input: string): WorkspacePathResult {
  const root = rootPrefix(normalizeLexicalPath(asPosixPath(workspaceRoot.trim())));
  if (!root) return { ok: false, error: "workspace_root 为空" };

  const raw = asPosixPath((input ?? "").trim() || ".");
  let candidate: string;
  if (raw === "." || raw === "./") {
    candidate = root;
  } else if (raw.startsWith("/") || /^[A-Za-z]:\//.test(raw)) {
    candidate = normalizeLexicalPath(raw);
  } else {
    candidate = normalizeLexicalPath(`${root}/${raw}`);
  }

  if (candidate !== root && !candidate.startsWith(`${root}/`)) {
    return { ok: false, error: `path escapes workspace_root: ${input}` };
  }

  const rel = candidate === root ? "." : candidate.slice(root.length + 1);
  return { ok: true, abs: candidate, rel };
}

function shouldSkipRel(rel: string): boolean {
  return rel.split("/").some((p) => SKIP_DIR_NAMES.has(p));
}

export function createPortalShellWorkspaceBackend(): WorkspaceFsBackend | null {
  const shell = typeof window !== "undefined" ? window.portalShell : undefined;
  const ws = shell?.workspaceFs;
  if (!ws) return null;
  const runCommand = shell.runCommand;
  return {
    listDir: (p) => ws.listDir(p),
    readText: (p) => ws.readText(p),
    writeText: (p, c) => ws.writeText(p, c),
    exists: (p) => ws.exists(p),
    isDir: (p) => ws.isDir(p),
    walkFiles: (p, opts) => ws.walkFiles(p, opts),
    ...(runCommand ? { runCommand: (opts) => runCommand(opts) } : {}),
  };
}

export class WorkspaceSandbox {
  readonly workspaceRoot: string;
  private readonly backend: WorkspaceFsBackend;

  constructor(workspaceRoot: string, backend: WorkspaceFsBackend) {
    this.workspaceRoot = rootPrefix(normalizeLexicalPath(asPosixPath(workspaceRoot)));
    this.backend = backend;
  }

  resolve(input: string): WorkspacePathResult {
    return resolveUnderWorkspace(this.workspaceRoot, input);
  }

  async fileList(opts?: {
    path?: string;
    maxDepth?: number;
    maxEntries?: number;
  }): Promise<{ ok: true; entries: WorkspaceTreeEntry[] } | { ok: false; error: string }> {
    const start = this.resolve(opts?.path ?? ".");
    if (!start.ok) return start;
    const maxDepth = Math.max(0, opts?.maxDepth ?? 3);
    const maxEntries = Math.max(1, opts?.maxEntries ?? 500);
    const entries: WorkspaceTreeEntry[] = [];

    const walk = async (abs: string, rel: string, depth: number): Promise<void> => {
      if (entries.length >= maxEntries) return;
      if (rel !== "." && shouldSkipRel(rel)) return;
      let kids: WorkspaceFsDirEntry[];
      try {
        kids = await this.backend.listDir(abs);
      } catch (e) {
        throw new Error(`listDir failed: ${e instanceof Error ? e.message : String(e)}`, {
          cause: e,
        });
      }
      kids.sort((a, b) => {
        if (a.kind !== b.kind) return a.kind === "dir" ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
      for (const kid of kids) {
        if (entries.length >= maxEntries) return;
        const childRel = rel === "." ? kid.name : `${rel}/${kid.name}`;
        if (shouldSkipRel(childRel)) continue;
        const childAbs = `${abs}/${kid.name}`;
        const entry: WorkspaceTreeEntry = { path: childRel, kind: kid.kind };
        if (kid.size != null) entry.size = kid.size;
        entries.push(entry);
        if (kid.kind === "dir" && depth < maxDepth) {
          await walk(childAbs, childRel, depth + 1);
        }
      }
    };

    try {
      const isDir = await this.backend.isDir(start.abs);
      if (!isDir) return { ok: false, error: `not a directory: ${start.rel}` };
      await walk(start.abs, start.rel === "." ? "." : start.rel, 0);
      return { ok: true, entries };
    } catch (e) {
      return { ok: false, error: String(e) };
    }
  }

  /** UI 预览：原始文本（无行号前缀） */
  async readTextRel(
    path: string,
  ): Promise<{ ok: true; text: string } | { ok: false; error: string }> {
    const resolved = this.resolve(path);
    if (!resolved.ok) return resolved;
    try {
      const content = await this.backend.readText(resolved.abs);
      return { ok: true, text: content };
    } catch (e) {
      return { ok: false, error: `read failed: ${e instanceof Error ? e.message : String(e)}` };
    }
  }

  async writeTextRel(
    path: string,
    content: string,
  ): Promise<{ ok: true; path: string } | { ok: false; error: string }> {
    const resolved = this.resolve(path);
    if (!resolved.ok) return resolved;
    try {
      await this.backend.writeText(resolved.abs, content);
      return { ok: true, path: resolved.rel };
    } catch (e) {
      return { ok: false, error: `write failed: ${e instanceof Error ? e.message : String(e)}` };
    }
  }

  async existsRel(path: string): Promise<boolean> {
    const resolved = this.resolve(path);
    if (!resolved.ok) return false;
    try {
      return await this.backend.exists(resolved.abs);
    } catch {
      return false;
    }
  }

  async isDirRel(path: string): Promise<boolean> {
    const resolved = this.resolve(path);
    if (!resolved.ok) return false;
    try {
      return await this.backend.isDir(resolved.abs);
    } catch {
      return false;
    }
  }

  async listDirRel(
    path: string,
  ): Promise<{ ok: true; entries: WorkspaceFsDirEntry[] } | { ok: false; error: string }> {
    const resolved = this.resolve(path);
    if (!resolved.ok) return resolved;
    try {
      const entries = await this.backend.listDir(resolved.abs);
      return { ok: true, entries };
    } catch (e) {
      return { ok: false, error: `listDir failed: ${e instanceof Error ? e.message : String(e)}` };
    }
  }

  async fileRead(opts: {
    path: string;
    offset?: number;
    limit?: number;
  }): Promise<{ ok: true; text: string } | { ok: false; error: string }> {
    const resolved = this.resolve(opts.path);
    if (!resolved.ok) return resolved;
    try {
      const content = await this.backend.readText(resolved.abs);
      const offset = Math.max(1, opts.offset ?? 1);
      const limit = Math.max(1, opts.limit ?? 500);
      const lines = content.split("\n");
      const slice = lines.slice(offset - 1, offset - 1 + limit);
      const text = slice.map((l, i) => `${offset + i}|${l}`).join("\n");
      return { ok: true, text };
    } catch (e) {
      return { ok: false, error: `read failed: ${e instanceof Error ? e.message : String(e)}` };
    }
  }

  async fileSearch(opts: {
    pattern: string;
    path?: string;
    limit?: number;
    output_mode?: "content" | "files_only" | "count";
  }): Promise<{ ok: true; result: string } | { ok: false; error: string }> {
    const pattern = opts.pattern;
    if (!pattern) return { ok: false, error: "pattern 不能为空" };
    const start = this.resolve(opts.path ?? ".");
    if (!start.ok) return start;
    const limit = Math.max(1, opts.limit ?? 50);
    const mode = opts.output_mode ?? "content";

    try {
      const files = await this.backend.walkFiles(start.abs, { maxFiles: 5000 });
      const root = this.workspaceRoot;
      const hits: string[] = [];
      let count = 0;

      for (const abs of files) {
        const absPosix = asPosixPath(abs);
        if (!absPosix.startsWith(`${root}/`) && absPosix !== root) continue;
        const rel = absPosix === root ? "." : absPosix.slice(root.length + 1);
        if (shouldSkipRel(rel)) continue;

        let text: string;
        try {
          text = await this.backend.readText(absPosix);
        } catch {
          continue;
        }
        if (!text.includes(pattern)) continue;
        count += 1;
        if (mode === "count") continue;
        if (mode === "files_only") {
          if (hits.length < limit) hits.push(rel);
          continue;
        }
        const lines = text.split("\n");
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          if (line == null || !line.includes(pattern)) continue;
          if (hits.length >= limit) break;
          hits.push(`${rel}:${i + 1}:${line}`);
        }
        if (hits.length >= limit) break;
      }

      if (mode === "count") {
        return { ok: true, result: JSON.stringify({ count }) };
      }
      return { ok: true, result: hits.join("\n") };
    } catch (e) {
      return { ok: false, error: `search failed: ${e instanceof Error ? e.message : String(e)}` };
    }
  }

  async filePatch(opts: {
    path: string;
    old_string: string;
    new_string: string;
    replace_all?: boolean;
  }): Promise<{ ok: true; path: string } | { ok: false; error: string }> {
    const resolved = this.resolve(opts.path);
    if (!resolved.ok) return resolved;
    if (!opts.old_string) return { ok: false, error: "old_string 不能为空" };
    try {
      let content = await this.backend.readText(resolved.abs);
      if (!content.includes(opts.old_string)) {
        return { ok: false, error: "old_string not found" };
      }
      const occurrences = content.split(opts.old_string).length - 1;
      if (!opts.replace_all && occurrences !== 1) {
        return {
          ok: false,
          error:
            occurrences === 0
              ? "old_string not found"
              : `old_string appears ${occurrences} times; must be unique or use replace_all`,
        };
      }
      content = opts.replace_all
        ? content.split(opts.old_string).join(opts.new_string)
        : content.replace(opts.old_string, opts.new_string);
      await this.backend.writeText(resolved.abs, content);
      return { ok: true, path: resolved.rel };
    } catch (e) {
      return { ok: false, error: `patch failed: ${e instanceof Error ? e.message : String(e)}` };
    }
  }

  async terminalRun(opts: {
    command: string;
    timeout?: number;
    workdir?: string;
    shell?: boolean;
  }): Promise<{ ok: true; text: string } | { ok: false; error: string }> {
    const command = opts.command?.trim();
    if (!command) return { ok: false, error: "command 不能为空" };
    const cwdRes = this.resolve(opts.workdir ?? ".");
    if (!cwdRes.ok) return cwdRes;
    if (!this.backend.runCommand) {
      return {
        ok: false,
        error:
          "terminal_run 需要 portalShell.runCommand（Rust IPC 尚未实现）。见 shell-api WorkspaceFs / runCommand。",
      };
    }
    try {
      const result = await this.backend.runCommand({
        command,
        cwd: cwdRes.abs,
        timeoutMs: Math.max(1, (opts.timeout ?? 180) * 1000),
        shell: Boolean(opts.shell),
      });
      let text = `${result.stdout}${result.stderr ? (result.stdout ? "\n" : "") + result.stderr : ""}`;
      if (result.exitCode !== 0) {
        text = `${text}${text ? "\n" : ""}--- exit code: ${result.exitCode} ---`;
      }
      return { ok: true, text };
    } catch (e) {
      return {
        ok: false,
        error: `terminal_run failed: ${e instanceof Error ? e.message : String(e)}`,
      };
    }
  }
}
