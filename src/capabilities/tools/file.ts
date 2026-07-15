import type { ToolSetRegistry } from "@freeanima/core/tool";
import { attachToolReturns, toolError, toolResult } from "@freeanima/core/tool";
import { CAPABILITIES_TOOLS_RETURNS } from "./return-schemas.ts";
import { assertPathAllowed, resolveToolPath } from "./path-policy.ts";
import { existsSync, mkdirSync, readFileSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, extname, join, resolve } from "node:path";

const BINARY_EXT = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".exe",
  ".dll",
  ".so",
  ".zip",
  ".pdf",
  ".db",
  ".sqlite",
]);

async function handleReadFile(path: string, offset = 1, limit = 500): Promise<string> {
  const resolved = resolveToolPath(path);
  const deny = assertPathAllowed(resolved, "read");
  if (deny) return toolError(deny);
  const ext = extname(resolved).toLowerCase();
  if (BINARY_EXT.has(ext)) return toolError("binary file type blocked");
  let content: string;
  try {
    content = await Bun.file(resolved).text();
  } catch (e) {
    return toolError(`read failed: ${e}`);
  }
  const lines = content.split("\n");
  const slice = lines.slice(Math.max(0, offset - 1), offset - 1 + limit);
  return slice.map((l, i) => `${offset + i}|${l}`).join("\n");
}

function handleWriteFile(path: string, content: string): string {
  const resolved = resolveToolPath(path);
  const deny = assertPathAllowed(resolved, "write");
  if (deny) return toolError(deny);
  try {
    mkdirSync(dirname(resolved), { recursive: true });
    writeFileSync(resolved, content, "utf-8");
    return toolResult({ ok: true, path: resolved });
  } catch (e) {
    return toolError(`write failed: ${e}`);
  }
}

function handleDeleteFile(path: string): string {
  const resolved = resolveToolPath(path);
  const deny = assertPathAllowed(resolved, "write");
  if (deny) return toolError(deny);
  if (!existsSync(resolved)) return toolError(`File does not exist: ${path}`);
  try {
    const st = statSync(resolved);
    if (st.isDirectory()) {
      return toolError("path is a directory; file_delete only removes a single file");
    }
    unlinkSync(resolved);
    return toolResult({ ok: true, path: resolved });
  } catch (e) {
    return toolError(`delete failed: ${e}`);
  }
}

function resolveSearchPath(path: string): string {
  return resolve(path);
}

/** meta chars that clearly indicate regex, not glob */
const REGEX_ONLY_METACHAR = /[()[\]{}^$+]/;

function looksLikeGlobPattern(pattern: string): boolean {
  const parts = pattern
    .split("|")
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length === 0) return false;
  return parts.every((part) => {
    if (REGEX_ONLY_METACHAR.test(part)) return false;
    return part.includes("*") || part.includes("?");
  });
}

function shouldSearchByFilename(pattern: string, target: string, outputMode: string): boolean {
  if (target === "files") return true;
  return target === "content" && outputMode === "files_only" && looksLikeGlobPattern(pattern);
}

function shouldSkipGlobPath(relPath: string): boolean {
  const parts = relPath.split(/[/\\]/);
  return parts.some((p) => p === "node_modules" || p === ".git");
}

async function findFilesByGlob(root: string, pattern: string): Promise<string[]> {
  const glob = new Bun.Glob(pattern);
  const out: string[] = [];
  for await (const rel of glob.scan({ cwd: root, onlyFiles: true })) {
    if (shouldSkipGlobPath(rel)) continue;
    out.push(join(root, rel));
  }
  return out;
}

function globPatternsFrom(pattern: string): string[] {
  if (pattern.includes("|")) {
    return pattern
      .split("|")
      .map((p) => p.trim())
      .filter(Boolean);
  }
  return [pattern];
}

async function searchFilesByGlob(
  pattern: string,
  path: string,
  limit: number,
  offset: number,
): Promise<string> {
  const base = resolveSearchPath(path);
  const deny = assertPathAllowed(base, "read");
  if (deny) return toolError(deny);
  if (!existsSync(base)) return toolError(`Path does not exist: ${path}`);
  const cap = Math.max(1, Math.min(limit, 5000));
  const off = Math.max(0, offset);

  const rootStat = statSync(base);
  const roots = rootStat.isFile() ? [dirname(base)] : [base];
  const globs = globPatternsFrom(pattern);
  const matches: string[] = [];
  for (const root of roots) {
    for (const globPat of globs) {
      try {
        matches.push(...(await findFilesByGlob(root, globPat)));
      } catch (e) {
        return toolError(String(e));
      }
    }
  }
  const unique = [...new Set(matches)];
  unique.sort((a, b) => {
    try {
      return statSync(b).mtimeMs - statSync(a).mtimeMs;
    } catch {
      return 0;
    }
  });
  const sliced = unique.slice(off, off + cap);
  return toolResult({ files: sliced, total: unique.length });
}

function appendRgPattern(cmd: string[], pattern: string, regex: boolean): void {
  if (regex) {
    cmd.push("--regexp", pattern);
  } else {
    cmd.push("--fixed-strings", pattern);
  }
}

async function handleSearchFiles(
  pattern: string,
  target = "content",
  path = ".",
  fileGlob?: string | null,
  limit = 50,
  offset = 0,
  outputMode = "content",
  context = 0,
  regex = false,
): Promise<string> {
  const base = resolveSearchPath(path);
  const deny = assertPathAllowed(base, "read");
  if (deny) return toolError(deny);
  if (!existsSync(base)) return toolError(`Path does not exist: ${path}`);
  const cap = Math.max(1, Math.min(limit, 5000));
  const off = Math.max(0, offset);

  if (shouldSearchByFilename(pattern, target, outputMode)) {
    return searchFilesByGlob(pattern, path, limit, offset);
  }

  const cmd: string[] = [];
  if (outputMode === "count") {
    cmd.push("rg", "--count-matches");
    appendRgPattern(cmd, pattern, regex);
  } else if (outputMode === "files_only") {
    cmd.push("rg", "--files-with-matches");
    appendRgPattern(cmd, pattern, regex);
  } else {
    cmd.push("rg", "--no-heading", "--line-number");
    appendRgPattern(cmd, pattern, regex);
  }
  if (outputMode === "content" && context > 0) cmd.push("-C", String(context));
  if (fileGlob) cmd.push("--glob", fileGlob);
  cmd.push(base);

  let proc: ReturnType<typeof spawnSync>;
  const bin = cmd[0];
  if (!bin) return toolError("ripgrep (rg) not found");
  try {
    proc = spawnSync(bin, cmd.slice(1), {
      encoding: "utf-8",
      timeout: 120_000,
      maxBuffer: 10 * 1024 * 1024,
    });
  } catch (e) {
    return toolError(String(e));
  }

  if (proc.error?.message?.includes("ENOENT")) {
    return toolError("rg (ripgrep) executable not found");
  }
  if (proc.error) return toolError(proc.error.message);

  const code = proc.status ?? 1;
  if (code !== 0 && code !== 1) {
    const err = String(proc.stderr ?? proc.stdout ?? "").trim();
    return toolError(err || `rg exit code ${code}`);
  }

  const out = String(proc.stdout ?? "").trim();
  if (outputMode === "count") {
    const lines = out.split("\n").filter((ln: string) => ln.trim());
    return toolResult({ counts: lines.slice(off, off + cap), raw: out });
  }

  const lines = out ? out.split("\n") : [];
  const total = lines.length;
  const sliced = lines.slice(off, off + cap);
  return toolResult({
    matches: sliced,
    total_lines: total,
    truncated: total > off + sliced.length,
  });
}

function handlePatch(
  path: string,
  old_string: string,
  new_string: string,
  replace_all = false,
): string {
  const resolved = resolveToolPath(path);
  const deny = assertPathAllowed(resolved, "write");
  if (deny) return toolError(deny);
  if (!existsSync(resolved)) return toolError(`File does not exist: ${path}`);
  try {
    let content = readFileSync(resolved, "utf-8");
    if (!content.includes(old_string)) return toolError("old_string not found");
    const count = content.split(old_string).length - 1;
    if (!replace_all && count !== 1) {
      return toolError(
        count === 0
          ? "old_string not found"
          : `old_string appears ${count} times; must be unique or use replace_all`,
      );
    }
    content = replace_all
      ? content.split(old_string).join(new_string)
      : content.replace(old_string, new_string);
    return handleWriteFile(resolved, content);
  } catch (e) {
    return toolError(`patch failed: ${e}`);
  }
}

export function registerFileTools(toolSets: ToolSetRegistry): void {
  toolSets.registerToolSet(
    "file",
    "File read/write and search",
    attachToolReturns(
      [
        {
          name: "file_read",
          description: "Read a text file with line numbers",
          parameters: {
            type: "object",
            properties: {
              path: { type: "string" },
              offset: { type: "integer", default: 1 },
              limit: { type: "integer", default: 500 },
            },
            required: ["path"],
          },
          handler: (a) =>
            handleReadFile(String(a.path), Number(a.offset ?? 1), Number(a.limit ?? 500)),
        },
        {
          name: "file_write",
          description: "Write file content",
          parameters: {
            type: "object",
            properties: {
              path: { type: "string" },
              content: { type: "string" },
            },
            required: ["path", "content"],
          },
          handler: (a) => handleWriteFile(String(a.path), String(a.content ?? "")),
        },
        {
          name: "file_delete",
          description:
            "Delete a single file (not a directory). Same path deny rules as file_write.",
          parameters: {
            type: "object",
            properties: {
              path: { type: "string" },
            },
            required: ["path"],
          },
          handler: (a) => handleDeleteFile(String(a.path)),
        },
        {
          name: "file_search",
          description:
            "Search files. target=files: pattern is glob (supports a|b segments). target=content: pattern is search text (literal by default, regex=true for regex). " +
            "When output_mode=files_only and pattern contains * ?, matches filenames automatically.",
          parameters: {
            type: "object",
            properties: {
              pattern: {
                type: "string",
                description: "glob (target=files) or search text/regex (target=content)",
              },
              target: {
                type: "string",
                enum: ["content", "files"],
                default: "content",
                description: "files=search by filename glob; content=search file contents",
              },
              path: { type: "string", default: "." },
              file_glob: {
                type: "string",
                description: "File glob limiting search in content mode",
              },
              regex: {
                type: "boolean",
                default: false,
                description: "content mode: true means pattern is regex; default false is literal",
              },
              limit: { type: "integer", default: 50 },
              offset: { type: "integer", default: 0 },
              output_mode: {
                type: "string",
                enum: ["content", "files_only", "count"],
                default: "content",
                description: "content=lines with content; files_only=paths only; count=count",
              },
              context: { type: "integer", default: 0 },
            },
            required: ["pattern"],
          },
          handler: (a) =>
            handleSearchFiles(
              String(a.pattern),
              String(a.target ?? "content"),
              String(a.path ?? "."),
              a.file_glob != null ? String(a.file_glob) : null,
              Number(a.limit ?? 50),
              Number(a.offset ?? 0),
              String(a.output_mode ?? "content"),
              Number(a.context ?? 0),
              Boolean(a.regex),
            ),
        },
        {
          name: "file_patch",
          description: "Replace string in file",
          parameters: {
            type: "object",
            properties: {
              path: { type: "string" },
              old_string: { type: "string" },
              new_string: { type: "string" },
              replace_all: { type: "boolean", default: false },
            },
            required: ["path", "old_string", "new_string"],
          },
          handler: (a) =>
            handlePatch(
              String(a.path),
              String(a.old_string),
              String(a.new_string),
              Boolean(a.replace_all),
            ),
        },
      ],
      CAPABILITIES_TOOLS_RETURNS,
    ),
  );
}
