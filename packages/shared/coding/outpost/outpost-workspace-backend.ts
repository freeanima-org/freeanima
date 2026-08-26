/**
 * 经 Habitat `coding.outpostExec` 驱动的 WorkspaceFsBackend（SSH / 远端 probe UI）。
 * 只读；写与终端仍走 Agent 回合的 remote tool.call。
 */

import { asPosixPath, normalizeLexicalPath, rootPrefix } from "./path.ts";
import type { WorkspaceFsBackend, WorkspaceFsDirEntry } from "./types.ts";
import type { CodingOutpostExecTool } from "@freeanima/shared/rpc-contract/frames/coding.ts";
import { asRecord } from "@freeanima/shared/util";

export type OutpostExecFn = (
  tool: CodingOutpostExecTool,
  args: Record<string, unknown>,
) => Promise<string>;

function stripLineNumbers(text: string): string {
  // file_read 返回 `N|content` 行；UI 预览需要原文
  return text
    .split("\n")
    .map((line) => {
      const m = line.match(/^\d+\|(.*)$/);
      return m ? (m[1] ?? "") : line;
    })
    .join("\n");
}

function parseJsonContent(content: string): Record<string, unknown> | null {
  try {
    const v = JSON.parse(content) as unknown;
    return asRecord(v);
  } catch {
    return null;
  }
}

function relFromAbs(workspaceRoot: string, absPath: string): string {
  const root = rootPrefix(normalizeLexicalPath(asPosixPath(workspaceRoot)));
  const abs = normalizeLexicalPath(asPosixPath(absPath));
  if (abs === root) return ".";
  if (abs.startsWith(`${root}/`)) return abs.slice(root.length + 1);
  return abs;
}

export function createOutpostWorkspaceBackend(opts: {
  workspaceRoot: string;
  exec: OutpostExecFn;
}): WorkspaceFsBackend {
  const workspaceRoot = rootPrefix(normalizeLexicalPath(asPosixPath(opts.workspaceRoot)));

  const listAt = async (rel: string): Promise<WorkspaceFsDirEntry[]> => {
    const content = await opts.exec("file_list", {
      path: rel,
      max_depth: 0,
      limit: 2000,
    });
    const parsed = parseJsonContent(content);
    if (!parsed || parsed.error) {
      throw new Error(typeof parsed?.error === "string" ? parsed.error : content.slice(0, 200));
    }
    const entriesRaw = Array.isArray(parsed.entries) ? parsed.entries : [];
    const out: WorkspaceFsDirEntry[] = [];
    for (const row of entriesRaw) {
      const r = asRecord(row);
      if (!r) continue;
      const path = typeof r.path === "string" ? r.path : "";
      const kind = r.kind === "dir" ? "dir" : "file";
      // file_list 在 max_depth=0 时 path 多为相对名或相对根路径
      const name = path.includes("/") ? path.slice(path.lastIndexOf("/") + 1) : path;
      if (!name || name === ".") continue;
      out.push({
        name,
        kind,
        ...(typeof r.size === "number" ? { size: r.size } : {}),
      });
    }
    return out;
  };

  return {
    async listDir(absPath) {
      return listAt(relFromAbs(workspaceRoot, absPath));
    },
    async readText(absPath) {
      const rel = relFromAbs(workspaceRoot, absPath);
      const content = await opts.exec("file_read", {
        path: rel,
        offset: 1,
        limit: 50_000,
      });
      const parsed = parseJsonContent(content);
      if (parsed?.error) {
        throw new Error(typeof parsed.error === "string" ? parsed.error : "read failed");
      }
      return stripLineNumbers(content);
    },
    async writeText() {
      throw new Error("远端工作区只读 backend：写入请经 Agent file_patch");
    },
    async exists(absPath) {
      const rel = relFromAbs(workspaceRoot, absPath);
      if (rel === ".") return true;
      const parent = rel.includes("/") ? rel.slice(0, rel.lastIndexOf("/")) : ".";
      const base = rel.includes("/") ? rel.slice(rel.lastIndexOf("/") + 1) : rel;
      try {
        const entries = await listAt(parent || ".");
        return entries.some((e) => e.name === base);
      } catch {
        return false;
      }
    },
    async isDir(absPath) {
      const rel = relFromAbs(workspaceRoot, absPath);
      if (rel === ".") return true;
      const parent = rel.includes("/") ? rel.slice(0, rel.lastIndexOf("/")) : ".";
      const base = rel.includes("/") ? rel.slice(rel.lastIndexOf("/") + 1) : rel;
      try {
        const entries = await listAt(parent || ".");
        return entries.some((e) => e.name === base && e.kind === "dir");
      } catch {
        return false;
      }
    },
    async walkFiles(absRoot, walkOpts) {
      const rel = relFromAbs(workspaceRoot, absRoot);
      const maxFiles = walkOpts?.maxFiles ?? 5000;
      const content = await opts.exec("file_list", {
        path: rel,
        max_depth: 20,
        limit: maxFiles,
      });
      const parsed = parseJsonContent(content);
      if (!parsed || parsed.error) {
        throw new Error(typeof parsed?.error === "string" ? parsed.error : "walk failed");
      }
      const entriesRaw = Array.isArray(parsed.entries) ? parsed.entries : [];
      const out: string[] = [];
      for (const row of entriesRaw) {
        const r = asRecord(row);
        if (!r || r.kind === "dir") continue;
        const path = typeof r.path === "string" ? r.path : "";
        if (!path) continue;
        const abs =
          path.startsWith("/") || /^[A-Za-z]:\//.test(path)
            ? normalizeLexicalPath(path)
            : normalizeLexicalPath(`${workspaceRoot}/${path}`);
        out.push(abs);
        if (out.length >= maxFiles) break;
      }
      return out;
    },
    async searchFiles(searchOpts) {
      const rel = relFromAbs(workspaceRoot, searchOpts.path);
      return opts.exec("file_search", {
        pattern: searchOpts.pattern,
        path: rel,
        limit: searchOpts.limit ?? 50,
        output_mode: searchOpts.outputMode ?? "content",
      });
    },
  };
}
