import type { WorkspacePathResult } from "./types.ts";

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

export function rootPrefix(rootPosix: string): string {
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

export function shouldSkipRel(rel: string): boolean {
  return rel.split("/").some((p) => SKIP_DIR_NAMES.has(p));
}
