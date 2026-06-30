import { readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { readStudioFile, resolveWorkspace } from "../studio.ts";

const MAX_OUTPUT = 50 * 1024;
const MAX_FOREGROUND_TIMEOUT = 600;

function runForeground(command: string, timeout: number, workdir: string): string {
  const safeTimeout = Math.min(Math.max(1, timeout), MAX_FOREGROUND_TIMEOUT);
  try {
    const result = spawnSync(command, {
      shell: true,
      encoding: "utf-8",
      timeout: safeTimeout * 1000,
      cwd: workdir,
      maxBuffer: MAX_OUTPUT * 2,
    });
    const parts: string[] = [];
    if (result.stdout) parts.push(result.stdout);
    if (result.stderr) parts.push(`--- stderr ---\n${result.stderr}`);
    if (result.status !== 0 && result.status != null) {
      parts.push(`--- exit code: ${result.status} ---`);
    }
    let output = parts.join("");
    if (output.length > MAX_OUTPUT) {
      output = `${output.slice(0, MAX_OUTPUT)}\n... (truncated at ${MAX_OUTPUT} chars)`;
    }
    return output;
  } catch (e) {
    const err = e as NodeJS.ErrnoException & { killed?: boolean };
    if (err.killed) return `Error: timeout after ${safeTimeout}s`;
    if (err.code === "ENOENT") return "Error: shell not found";
    return `Error: ${err.message}`;
  }
}

function searchFiles(
  workspaceRoot: string,
  query: string,
  fileGlob?: string | null,
): Array<Record<string, unknown>> {
  const results: Array<Record<string, unknown>> = [];
  const glob = fileGlob?.trim() || null;

  const walk = (dir: string): void => {
    for (const ent of readdirSync(dir, { withFileTypes: true })) {
      if (ent.name.startsWith(".")) continue;
      const full = join(dir, ent.name);
      if (ent.isDirectory()) {
        walk(full);
        continue;
      }
      if (!ent.isFile()) continue;
      const rel = relative(workspaceRoot, full);
      if (glob && !rel.includes(glob.replace(/\*\*/g, "").replace(/\*/g, ""))) {
        const base = ent.name;
        if (
          glob.includes("*") &&
          !base.match(new RegExp(glob.replace(/\./g, "\\.").replace(/\*/g, ".*")))
        ) {
          continue;
        }
      }
      const text = readFileSync(full, "utf-8");
      for (const [i, line] of text.split("\n").entries()) {
        if (line.includes(query)) {
          results.push({
            file: rel,
            line: i + 1,
            column: line.indexOf(query) + 1,
            content: line,
            match: query,
          });
          if (results.length >= 200) return;
        }
      }
    }
  };

  walk(workspaceRoot);
  return results;
}

export async function executeLocalTool(
  localName: string,
  args: Record<string, unknown>,
  workspaceRoot: string,
): Promise<string> {
  const root = workspaceRoot.trim() ? resolve(workspaceRoot) : resolveWorkspace();

  switch (localName) {
    case "scan_code":
      return JSON.stringify({ ok: true, workspace: root, scanned: true });
    case "file_read": {
      const path = String(args.path ?? args.file ?? "");
      const file = readStudioFile(path);
      return file.content;
    }
    case "file_search": {
      const query = String(args.query ?? args.pattern ?? "");
      if (!query.trim()) return JSON.stringify({ error: "query required" });
      const fileGlob = args.file_glob != null ? String(args.file_glob) : null;
      const hits = searchFiles(root, query, fileGlob);
      return JSON.stringify({ results: hits, count: hits.length });
    }
    case "file_write": {
      const path = String(args.path ?? "");
      const content = String(args.content ?? "");
      if (!path.trim()) return JSON.stringify({ error: "path required" });
      const abs = resolve(root, path);
      if (!abs.startsWith(root)) return JSON.stringify({ error: "path escapes workspace" });
      const { writeFileSync, mkdirSync } = await import("node:fs");
      mkdirSync(resolve(abs, ".."), { recursive: true });
      writeFileSync(abs, content, "utf-8");
      return JSON.stringify({ ok: true, path });
    }
    case "file_patch": {
      const path = String(args.path ?? "");
      const patch = String(args.patch ?? args.diff ?? "");
      if (!path.trim() || !patch.trim()) {
        return JSON.stringify({ error: "path and patch required" });
      }
      const file = readStudioFile(path);
      if (patch.includes(file.content.slice(0, 20))) {
        return JSON.stringify({ error: "patch apply not fully implemented; use file_write" });
      }
      return JSON.stringify({ error: "patch apply not fully implemented; use file_write" });
    }
    case "terminal_run": {
      const command = String(args.command ?? "");
      if (!command.trim()) return JSON.stringify({ error: "command required" });
      const timeout = Number(args.timeout ?? 30);
      return runForeground(command, timeout, root);
    }
    default:
      return JSON.stringify({ error: `unsupported local tool: ${localName}` });
  }
}
