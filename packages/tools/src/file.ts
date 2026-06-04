import { registerTool, toolError, toolResult } from "@freeanima/legacy-kernel";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  realpathSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, extname, join, resolve } from "node:path";
import { homedir } from "node:os";

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

const BLOCKED_DEVICES = new Set([
  "/dev/random",
  "/dev/urandom",
  "/dev/zero",
  "/dev/null",
  "/dev/full",
]);

function home(): string {
  return homedir();
}

function deniedWritePaths(): Set<string> {
  const h = home();
  const paths = [
    join(h, ".ssh", "authorized_keys"),
    join(h, ".ssh", "id_rsa"),
    join(h, ".ssh", "id_ed25519"),
    "/etc/passwd",
    "/etc/shadow",
    "/etc/sudoers",
  ];
  const out = new Set<string>();
  for (const p of paths) {
    try {
      if (existsSync(p)) out.add(realpathSync(p));
    } catch {
      /* 路径不存在或不可解析则跳过 */
    }
  }
  return out;
}

function resolveFilePath(filepath: string): string {
  const p = filepath.trim();
  if (p.startsWith("~/")) return resolve(home(), p.slice(2));
  if (p === "~") return home();
  if (!p.startsWith("/")) return resolve(process.cwd(), p);
  return resolve(p);
}

function realpathIfExists(path: string): string | null {
  try {
    return realpathSync(path);
  } catch {
    return null;
  }
}

function isDeniedRead(path: string): string | null {
  const rp = realpathIfExists(path) ?? resolveFilePath(path);
  if (BLOCKED_DEVICES.has(rp)) return "blocked device path";
  if (rp.startsWith("/proc/") || rp.startsWith("/sys/")) return "blocked system path";

  const sshDir = join(home(), ".ssh");
  if (existsSync(sshDir)) {
    const sshReal = realpathIfExists(sshDir);
    if (sshReal && rp.startsWith(`${sshReal}/`) && !rp.endsWith(".pub")) {
      return "blocked ssh private path";
    }
  }
  return null;
}

function isDeniedWrite(path: string): string | null {
  const resolved = resolveFilePath(path);
  if (!existsSync(resolved)) {
    const parent = dirname(resolved);
    if (existsSync(parent)) {
      const err = isDeniedRead(parent);
      if (err) return err;
    }
    return null;
  }
  const readErr = isDeniedRead(resolved);
  if (readErr) return readErr;
  const rp = realpathIfExists(resolved);
  if (!rp) return "invalid path";
  if (deniedWritePaths().has(rp)) return "write denied";
  return null;
}

function handleReadFile(path: string, offset = 1, limit = 500): string {
  const resolved = resolveFilePath(path);
  const deny = isDeniedRead(resolved);
  if (deny) return toolError(deny);
  const ext = extname(resolved).toLowerCase();
  if (BINARY_EXT.has(ext)) return toolError("binary file type blocked");
  let content: string;
  try {
    content = readFileSync(resolved, "utf-8");
  } catch (e) {
    return toolError(`read failed: ${e}`);
  }
  const lines = content.split("\n");
  const slice = lines.slice(Math.max(0, offset - 1), offset - 1 + limit);
  return slice.map((l, i) => `${offset + i}|${l}`).join("\n");
}

function handleWriteFile(path: string, content: string): string {
  const resolved = resolveFilePath(path);
  const deny = isDeniedWrite(resolved);
  if (deny) return toolError(deny);
  try {
    mkdirSync(dirname(resolved), { recursive: true });
    writeFileSync(resolved, content, "utf-8");
    return toolResult({ ok: true, path: resolved });
  } catch (e) {
    return toolError(`write failed: ${e}`);
  }
}

function resolveSearchPath(path: string): string {
  return resolve(path);
}

/** 明显属于正则、而非 glob 的元字符 */
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

function globNameMatch(name: string, pattern: string): boolean {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*/g, ".*")
    .replace(/\?/g, ".");
  return new RegExp(`^${escaped}$`).test(name);
}

function findFilesByGlob(root: string, pattern: string): string[] {
  const out: string[] = [];
  const walk = (dir: string): void => {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const ent of entries) {
      const full = join(dir, ent.name);
      if (ent.isDirectory()) {
        if (ent.name === "node_modules" || ent.name === ".git") continue;
        walk(full);
      } else if (ent.isFile() && globNameMatch(ent.name, pattern)) {
        out.push(full);
      }
    }
  };
  walk(root);
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

function searchFilesByGlob(pattern: string, path: string, limit: number, offset: number): string {
  const base = resolveSearchPath(path);
  if (!existsSync(base)) return toolError(`路径不存在: ${path}`);
  const cap = Math.max(1, Math.min(limit, 5000));
  const off = Math.max(0, offset);

  const rootStat = statSync(base);
  const roots = rootStat.isFile() ? [dirname(base)] : [base];
  const globs = globPatternsFrom(pattern);
  const matches: string[] = [];
  for (const root of roots) {
    for (const globPat of globs) {
      try {
        matches.push(...findFilesByGlob(root, globPat));
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

function handleSearchFiles(
  pattern: string,
  target = "content",
  path = ".",
  fileGlob?: string | null,
  limit = 50,
  offset = 0,
  outputMode = "content",
  context = 0,
  regex = false,
): string {
  const base = resolveSearchPath(path);
  if (!existsSync(base)) return toolError(`路径不存在: ${path}`);
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
  try {
    proc = spawnSync(cmd[0]!, cmd.slice(1), {
      encoding: "utf-8",
      timeout: 120_000,
      maxBuffer: 10 * 1024 * 1024,
    });
  } catch (e) {
    return toolError(String(e));
  }

  if (proc.error?.message?.includes("ENOENT")) {
    return toolError("未找到 rg（ripgrep）可执行文件");
  }
  if (proc.error) return toolError(proc.error.message);

  const code = proc.status ?? 1;
  if (code !== 0 && code !== 1) {
    const err = String(proc.stderr ?? proc.stdout ?? "").trim();
    return toolError(err || `rg 退出码 ${code}`);
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
  const resolved = resolveFilePath(path);
  const deny = isDeniedWrite(resolved);
  if (deny) return toolError(deny);
  if (!existsSync(resolved)) return toolError(`文件不存在: ${path}`);
  try {
    let content = readFileSync(resolved, "utf-8");
    if (!content.includes(old_string)) return toolError("old_string not found");
    const count = content.split(old_string).length - 1;
    if (!replace_all && count !== 1) {
      return toolError(
        count === 0
          ? "old_string not found"
          : `old_string 出现 ${count} 次，需唯一或改用 replace_all`,
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

export function registerFileTools(): void {
  registerTool({
    name: "read_file",
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
    handler: (a) => handleReadFile(String(a.path), Number(a.offset ?? 1), Number(a.limit ?? 500)),
  });

  registerTool({
    name: "write_file",
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
  });

  registerTool({
    name: "search_files",
    description:
      "搜索文件。target=files：pattern 为 glob（支持 a|b 多段）。target=content：pattern 为搜索文字（默认字面量，regex=true 为正则）。" +
      "output_mode=files_only 且 pattern 含 * ? 时自动按文件名匹配。",
    parameters: {
      type: "object",
      properties: {
        pattern: {
          type: "string",
          description: "glob（target=files）或搜索文字/正则（target=content）",
        },
        target: {
          type: "string",
          enum: ["content", "files"],
          default: "content",
          description: "files=按文件名 glob；content=按文件内容搜索",
        },
        path: { type: "string", default: "." },
        file_glob: { type: "string", description: "content 模式下限制搜索的文件 glob" },
        regex: {
          type: "boolean",
          default: false,
          description: "content 模式：true 时 pattern 为正则；默认 false 为字面量",
        },
        limit: { type: "integer", default: 50 },
        offset: { type: "integer", default: 0 },
        output_mode: {
          type: "string",
          enum: ["content", "files_only", "count"],
          default: "content",
          description: "content=带行内容；files_only=仅路径；count=计数",
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
  });

  registerTool({
    name: "patch",
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
  });
}
