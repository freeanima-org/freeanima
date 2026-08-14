import { existsSync, realpathSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { homedir } from "node:os";

export type PathAccessMode = "read" | "write";

const BLOCKED_DEVICES = new Set([
  "/dev/random",
  "/dev/urandom",
  "/dev/zero",
  "/dev/null",
  "/dev/full",
]);

/** System tree roots blocked for catastrophic ops and write/read policy. */
export const SYSTEM_TREE_ROOTS = [
  "/etc",
  "/boot",
  "/usr",
  "/bin",
  "/sbin",
  "/lib",
  "/lib64",
  "/var",
  "/dev",
  "/proc",
  "/sys",
  "/root",
] as const;

export function toolHome(): string {
  const envHome = process.env.HOME?.trim() || process.env.USERPROFILE?.trim();
  if (envHome) return resolve(envHome);
  return homedir();
}

export function animaHome(): string {
  const env = process.env.FREEANIMA_HOME?.trim();
  if (env) return resolve(env);
  return resolve(toolHome(), ".anima");
}

function asPosixPath(path: string): string {
  return path.replace(/\\/g, "/");
}

/** Lexical normalize: collapse `.` / `..` without requiring the path to exist. */
export function normalizeLexicalPath(path: string): string {
  const posix = asPosixPath(path);
  const abs =
    posix.startsWith("/") || /^[A-Za-z]:\//.test(posix) ? posix : asPosixPath(resolve(path));
  const parts = abs.split("/").filter((p) => p.length > 0 && p !== ".");
  const out: string[] = [];
  for (const part of parts) {
    if (part === "..") {
      out.pop();
      continue;
    }
    out.push(part);
  }
  return `/${out.join("/")}`;
}

export function resolveToolPath(filepath: string, cwd: string = process.cwd()): string {
  const p = filepath.trim();
  if (p.startsWith("~/")) return resolve(toolHome(), p.slice(2));
  if (p === "~") return toolHome();
  if (!p.startsWith("/")) return resolve(cwd, p);
  return resolve(p);
}

export function expandHomeTokens(raw: string): string {
  let s = raw.trim();
  if (s === "~" || s === "~/") return toolHome();
  if (s.startsWith("~/")) return join(toolHome(), s.slice(2));
  s = s.replace(/^\$\{HOME\}/, toolHome()).replace(/^\$HOME/, toolHome());
  return s;
}

function realpathIfExists(path: string): string | null {
  try {
    return realpathSync(path);
  } catch {
    return null;
  }
}

function pathEqualsOrUnder(candidate: string, root: string): boolean {
  const c = resolve(candidate);
  const r = resolve(root);
  if (c === r) return true;
  const rel = relative(r, c);
  return rel !== "" && !rel.startsWith("..") && !isAbsolute(rel);
}

/** True when raw input is a POSIX absolute path under `root` (before OS resolve). */
function isPosixUnderRoot(raw: string, root: string): boolean {
  const posix = asPosixPath(raw.trim());
  return posix === root || posix.startsWith(`${root}/`);
}

function endsWithPub(path: string): boolean {
  return asPosixPath(path).endsWith(".pub");
}

/**
 * Catastrophic when operand is `/`, `/*`, home, home/*, a system tree root
 * (+ descendants), or FREEANIMA_HOME / vault.
 */
export function isCatastrophicPath(rawOperand: string, cwd: string = process.cwd()): boolean {
  return isCatastrophicRmTarget(rawOperand, cwd);
}

/** @see isCatastrophicPath */
export function isCatastrophicRmTarget(rawOperand: string, cwd: string = process.cwd()): boolean {
  const trimmed = rawOperand.trim();
  if (trimmed === "/*" || trimmed === "/") return true;
  if (trimmed === "~" || trimmed === "~/" || trimmed === "~/*") return true;
  if (
    trimmed === "$HOME" ||
    trimmed === "${HOME}" ||
    trimmed === "$HOME/" ||
    trimmed === "$HOME/*" ||
    trimmed === "${HOME}/" ||
    trimmed === "${HOME}/*"
  ) {
    return true;
  }
  if (trimmed.endsWith("/*")) {
    return isCatastrophicRmTarget(trimmed.slice(0, -2), cwd);
  }

  for (const root of SYSTEM_TREE_ROOTS) {
    if (isPosixUnderRoot(trimmed, root)) return true;
  }

  const expanded = expandHomeTokens(trimmed);
  for (const root of SYSTEM_TREE_ROOTS) {
    if (isPosixUnderRoot(expanded, root)) return true;
  }

  const resolvedAbs = asPosixPath(expanded).startsWith("/")
    ? resolve(expanded)
    : resolveToolPath(expanded, cwd);
  if (resolve(resolvedAbs) === resolve(toolHome())) return true;

  for (const root of SYSTEM_TREE_ROOTS) {
    if (pathEqualsOrUnder(resolvedAbs, root)) return true;
  }

  if (pathEqualsOrUnder(resolvedAbs, animaHome())) return true;

  return false;
}

function vaultDir(): string {
  return join(animaHome(), "vault");
}

function denyPosixSensitive(raw: string): string | null {
  const posix = asPosixPath(raw.trim());
  if (BLOCKED_DEVICES.has(posix)) return "blocked device path";
  if (
    posix === "/proc" ||
    posix.startsWith("/proc/") ||
    posix === "/sys" ||
    posix.startsWith("/sys/")
  ) {
    return "blocked system path";
  }
  if (posix === "/etc" || posix.startsWith("/etc/")) return "blocked /etc path";
  return null;
}

function assertDeniedSensitive(path: string, rawInput?: string): string | null {
  const fromRaw = denyPosixSensitive(rawInput ?? path);
  if (fromRaw) return fromRaw;

  const rp = realpathIfExists(path) ?? resolve(path);

  if (pathEqualsOrUnder(rp, "/etc")) return "blocked /etc path";
  if (pathEqualsOrUnder(rp, "/proc") || pathEqualsOrUnder(rp, "/sys")) {
    return "blocked system path";
  }

  const sshDir = join(toolHome(), ".ssh");
  if (existsSync(sshDir)) {
    const sshReal = realpathIfExists(sshDir) ?? resolve(sshDir);
    if (pathEqualsOrUnder(rp, sshReal) && !endsWithPub(rp)) {
      return "blocked ssh private path";
    }
  } else if (pathEqualsOrUnder(rp, sshDir) && !endsWithPub(rp)) {
    return "blocked ssh private path";
  }

  const vault = vaultDir();
  const vaultReal = realpathIfExists(vault) ?? resolve(vault);
  if (pathEqualsOrUnder(rp, vaultReal)) return "blocked vault path";

  return null;
}

/**
 * Returns a deny reason, or null when the path is allowed.
 * Write checks parent when the target does not exist yet.
 */
export function assertPathAllowed(
  filepath: string,
  mode: PathAccessMode,
  cwd: string = process.cwd(),
): string | null {
  const resolved = resolveToolPath(filepath, cwd);

  if (mode === "read") {
    return assertDeniedSensitive(resolved, filepath);
  }

  // write
  if (!existsSync(resolved)) {
    const parent = dirname(resolved);
    if (existsSync(parent)) {
      const err = assertDeniedSensitive(parent, filepath);
      if (err) return err;
    } else {
      // Parent missing: still block obvious forbidden prefixes (e.g. /etc/foo/new)
      const err = assertDeniedSensitive(resolved, filepath);
      if (err) return err;
    }
    return null;
  }

  const readErr = assertDeniedSensitive(resolved, filepath);
  if (readErr) return readErr;
  return null;
}
