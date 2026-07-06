import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
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

export type ClientMethodContext = {
  projectCwd: string;
};

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
      /* ignore */
    }
  }
  return out;
}

function resolvePath(filepath: string, projectCwd: string): string {
  const p = filepath.trim();
  if (p.startsWith("~/")) return resolve(home(), p.slice(2));
  if (p === "~") return home();
  if (!p.startsWith("/")) return resolve(projectCwd, p);
  return resolve(p);
}

function realpathIfExists(path: string): string | null {
  try {
    return realpathSync(path);
  } catch {
    return null;
  }
}

function isDeniedRead(path: string, projectCwd: string): string | null {
  const rp = realpathIfExists(path) ?? resolvePath(path, projectCwd);
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

function isDeniedWrite(path: string, projectCwd: string): string | null {
  const resolved = resolvePath(path, projectCwd);
  if (!existsSync(resolved)) {
    const parent = dirname(resolved);
    if (existsSync(parent)) {
      const err = isDeniedRead(parent, projectCwd);
      if (err) return err;
    }
    return null;
  }
  const readErr = isDeniedRead(resolved, projectCwd);
  if (readErr) return readErr;
  const rp = realpathIfExists(resolved);
  if (!rp) return "invalid path";
  if (deniedWritePaths().has(rp)) return "write denied";
  return null;
}

function readTextAtPath(
  path: string,
  projectCwd: string,
  line?: number,
  limit?: number,
): { content: string } | { error: string } {
  const resolved = resolvePath(path, projectCwd);
  const deny = isDeniedRead(resolved, projectCwd);
  if (deny) return { error: deny };
  const ext = extname(resolved).toLowerCase();
  if (BINARY_EXT.has(ext)) return { error: "binary file type blocked" };
  let content: string;
  try {
    content = readFileSync(resolved, "utf-8");
  } catch (e) {
    return { error: `read failed: ${e}` };
  }
  if (line != null || limit != null) {
    const lines = content.split("\n");
    const start = Math.max(0, (line ?? 1) - 1);
    const end = limit != null ? start + limit : lines.length;
    content = lines.slice(start, end).join("\n");
  }
  return { content };
}

function writeTextAtPath(
  path: string,
  content: string,
  projectCwd: string,
  backup = false,
): Record<string, unknown> | { error: string } {
  const resolved = resolvePath(path, projectCwd);
  const deny = isDeniedWrite(resolved, projectCwd);
  if (deny) return { error: deny };
  try {
    if (backup && existsSync(resolved)) {
      copyFileSync(resolved, `${resolved}.bak`);
    }
    mkdirSync(dirname(resolved), { recursive: true });
    writeFileSync(resolved, content, "utf-8");
    return { ok: true, path: resolved };
  } catch (e) {
    return { error: `write failed: ${e}` };
  }
}

function searchCodebase(
  params: Record<string, unknown>,
  ctx: ClientMethodContext,
): Record<string, unknown> {
  const query = String(params.query ?? params.pattern ?? params.text ?? "").trim();
  if (!query) return { error: "missing query" };
  const path = String(params.path ?? params.cwd ?? ctx.projectCwd);
  const limit = Math.min(Number(params.limit ?? 50) || 50, 500);
  const regex = params.regex === true;

  const base = resolve(path);
  if (!existsSync(base)) return { error: `path not found: ${path}` };

  const cmd: string[] = ["rg", "--no-heading", "--line-number"];
  if (regex) cmd.push("--regexp", query);
  else cmd.push("--fixed-strings", query);
  const fileGlob = params.file_glob ?? params.fileGlob;
  if (typeof fileGlob === "string" && fileGlob) cmd.push("--glob", fileGlob);
  cmd.push(base);

  const bin = cmd[0];
  if (!bin) return { error: "ripgrep (rg) not found" };
  const proc = spawnSync(bin, cmd.slice(1), {
    encoding: "utf-8",
    timeout: 120_000,
    maxBuffer: 10 * 1024 * 1024,
  });
  if (proc.error?.message?.includes("ENOENT")) {
    return { error: "ripgrep (rg) not found" };
  }
  const code = proc.status ?? 1;
  if (code !== 0 && code !== 1) {
    return { error: String(proc.stderr ?? proc.stdout ?? `rg exit ${code}`).trim() };
  }
  const lines = String(proc.stdout ?? "")
    .trim()
    .split("\n")
    .filter(Boolean)
    .slice(0, limit);
  return { matches: lines, total: lines.length, query };
}

function analyzeCode(
  params: Record<string, unknown>,
  ctx: ClientMethodContext,
): Record<string, unknown> {
  const path = String(params.path ?? params.file ?? "").trim();
  if (!path) return { error: "missing path" };
  const read = readTextAtPath(path, ctx.projectCwd);
  if ("error" in read) return { error: read.error };
  const content = read.content;
  const lines = content.split("\n");
  const ext = extname(path).toLowerCase();
  const stats = {
    path: resolvePath(path, ctx.projectCwd),
    extension: ext,
    lines: lines.length,
    chars: content.length,
    blankLines: lines.filter((l) => !l.trim()).length,
    functions: (content.match(/function\s+\w+|const\s+\w+\s*=\s*(?:async\s*)?\(/g) ?? []).length,
    classes: (content.match(/class\s+\w+/g) ?? []).length,
    imports: (content.match(/^import\s+/gm) ?? []).length,
  };
  return { analysis: stats, preview: lines.slice(0, 30).join("\n") };
}

function applyCodeChanges(
  params: Record<string, unknown>,
  ctx: ClientMethodContext,
): Record<string, unknown> {
  const path = String(params.path ?? params.file ?? "").trim();
  const content = params.content ?? params.changes;
  if (!path) return { error: "missing path" };
  if (typeof content !== "string") return { error: "missing content" };
  const result = writeTextAtPath(path, content, ctx.projectCwd, true);
  if ("error" in result) return result;
  return { outcome: "applied", ...result };
}

function detectTestCommand(projectCwd: string): string[] {
  const pkgPath = join(projectCwd, "package.json");
  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, "utf-8")) as Record<string, unknown>;
      const scripts = pkg.scripts as Record<string, string> | undefined;
      if (scripts?.test && !scripts.test.includes("no test")) {
        return ["npm", "test"];
      }
    } catch {
      /* ignore */
    }
  }
  if (existsSync(join(projectCwd, "bun.lock")) || existsSync(join(projectCwd, "bunfig.toml"))) {
    return ["bun", "test"];
  }
  if (
    existsSync(join(projectCwd, "pyproject.toml")) ||
    existsSync(join(projectCwd, "pytest.ini"))
  ) {
    return ["python", "-m", "pytest"];
  }
  if (existsSync(join(projectCwd, "Cargo.toml"))) {
    return ["cargo", "test"];
  }
  if (existsSync(join(projectCwd, "go.mod"))) {
    return ["go", "test", "./..."];
  }
  return [];
}

function runTests(
  params: Record<string, unknown>,
  ctx: ClientMethodContext,
): Record<string, unknown> {
  const custom = params.command;
  let cmd: string[];
  if (typeof custom === "string" && custom.trim()) {
    cmd = custom.trim().split(/\s+/);
  } else if (Array.isArray(custom)) {
    cmd = custom.map(String);
  } else {
    cmd = detectTestCommand(ctx.projectCwd);
  }
  if (cmd.length === 0) return { error: "could not detect test command" };

  const bin = cmd[0];
  if (!bin) return { error: "ripgrep (rg) not found" };
  const proc = spawnSync(bin, cmd.slice(1), {
    cwd: ctx.projectCwd,
    encoding: "utf-8",
    timeout: Number(params.timeout_ms ?? 300_000) || 300_000,
    maxBuffer: 20 * 1024 * 1024,
  });
  return {
    command: cmd.join(" "),
    exitCode: proc.status,
    stdout: String(proc.stdout ?? "").slice(-8000),
    stderr: String(proc.stderr ?? "").slice(-4000),
    success: proc.status === 0,
  };
}

function getProjectInfo(
  _params: Record<string, unknown>,
  ctx: ClientMethodContext,
): Record<string, unknown> {
  const info: Record<string, unknown> = { cwd: ctx.projectCwd };
  const markers = [
    "package.json",
    "pyproject.toml",
    "Cargo.toml",
    "go.mod",
    "pom.xml",
    "build.gradle",
    "Makefile",
  ];
  const found: string[] = [];
  for (const m of markers) {
    if (existsSync(join(ctx.projectCwd, m))) found.push(m);
  }
  info.projectMarkers = found;

  const pkgPath = join(ctx.projectCwd, "package.json");
  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, "utf-8")) as Record<string, unknown>;
      info.name = pkg.name;
      info.version = pkg.version;
      info.dependencies = Object.keys((pkg.dependencies as Record<string, string>) ?? {});
      info.devDependencies = Object.keys((pkg.devDependencies as Record<string, string>) ?? {});
      info.scripts = Object.keys((pkg.scripts as Record<string, string>) ?? {});
    } catch {
      /* ignore */
    }
  }

  let fileCount = 0;
  const walk = (dir: string, depth: number): void => {
    if (depth > 3 || fileCount > 500) return;
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const ent of entries) {
      if (ent.name === "node_modules" || ent.name === ".git") continue;
      if (ent.isFile()) fileCount += 1;
      else if (ent.isDirectory()) walk(join(dir, ent.name), depth + 1);
    }
  };
  walk(ctx.projectCwd, 0);
  info.approxFileCount = fileCount;
  return info;
}

function explainCode(
  params: Record<string, unknown>,
  ctx: ClientMethodContext,
): Record<string, unknown> {
  const path = String(params.path ?? params.file ?? "").trim();
  if (!path) return { error: "missing path" };
  const line = params.line != null ? Number(params.line) : undefined;
  const limit = params.limit != null ? Number(params.limit) : 200;
  const read = readTextAtPath(
    path,
    ctx.projectCwd,
    Number.isFinite(line) ? line : undefined,
    Number.isFinite(limit) ? limit : 200,
  );
  if ("error" in read) return { error: read.error };
  const resolved = resolvePath(path, ctx.projectCwd);
  let lang = extname(path).slice(1);
  if (!lang && existsSync(resolved)) {
    try {
      lang = extname(resolved).slice(1);
    } catch {
      /* ignore */
    }
  }
  return {
    path: resolved,
    language: lang || "text",
    content: read.content,
    note: "Code content for Agent interpretation; client provides no extra AI analysis.",
  };
}

/** ACP / Cursor client methods (Agent → Client) */
export function handleClientMethod(
  method: string,
  params: Record<string, unknown>,
  ctx: ClientMethodContext,
): Record<string, unknown> | null {
  if (method === "fs/read_text_file") {
    const path = String(params.path ?? "");
    const line = params.line != null ? Number(params.line) : undefined;
    const limit = params.limit != null ? Number(params.limit) : undefined;
    const read = readTextAtPath(path, ctx.projectCwd, line, limit);
    if ("error" in read) return { error: read.error };
    return { content: read.content };
  }

  if (method === "fs/write_text_file") {
    const path = String(params.path ?? "");
    const content = String(params.content ?? "");
    const result = writeTextAtPath(path, content, ctx.projectCwd);
    if ("error" in result) return result;
    return {};
  }

  if (method === "search_codebase") return searchCodebase(params, ctx);
  if (method === "analyze_code") return analyzeCode(params, ctx);
  if (method === "apply_code_changes") return applyCodeChanges(params, ctx);
  if (method === "run_tests") return runTests(params, ctx);
  if (method === "get_project_info") return getProjectInfo(params, ctx);
  if (method === "explain_code") return explainCode(params, ctx);

  return null;
}
