import { existsSync, realpathSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
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

/** Lexical normalize: collapse `.` / `..` without requiring the path to exist. */
export function normalizeLexicalPath(path: string): string {
  const abs = path.startsWith("/") ? path : resolve(path);
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
  const c = normalizeLexicalPath(candidate);
  const r = normalizeLexicalPath(root);
  if (c === r) return true;
  return c.startsWith(`${r}/`);
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

  const expanded = expandHomeTokens(trimmed);
  const resolved = normalizeLexicalPath(
    expanded.startsWith("/") ? resolve(expanded) : resolveToolPath(expanded, cwd),
  );
  if (resolved === "/") return true;
  if (resolved === normalizeLexicalPath(toolHome())) return true;

  for (const root of SYSTEM_TREE_ROOTS) {
    if (pathEqualsOrUnder(resolved, root)) return true;
  }

  const anima = normalizeLexicalPath(animaHome());
  if (pathEqualsOrUnder(resolved, anima)) return true;

  return false;
}

function vaultDir(): string {
  return join(animaHome(), "vault");
}

function isUnderEtc(path: string): boolean {
  return pathEqualsOrUnder(path, "/etc");
}

function assertDeniedSensitive(path: string): string | null {
  const rp = realpathIfExists(path) ?? normalizeLexicalPath(path);

  if (BLOCKED_DEVICES.has(rp)) return "blocked device path";
  if (rp === "/proc" || rp.startsWith("/proc/") || rp === "/sys" || rp.startsWith("/sys/")) {
    return "blocked system path";
  }
  if (isUnderEtc(rp)) return "blocked /etc path";

  const sshDir = join(toolHome(), ".ssh");
  if (existsSync(sshDir)) {
    const sshReal = realpathIfExists(sshDir) ?? normalizeLexicalPath(sshDir);
    if (pathEqualsOrUnder(rp, sshReal) && !rp.endsWith(".pub")) {
      return "blocked ssh private path";
    }
  } else {
    const sshLexical = normalizeLexicalPath(sshDir);
    if (pathEqualsOrUnder(rp, sshLexical) && !rp.endsWith(".pub")) {
      return "blocked ssh private path";
    }
  }

  const vault = vaultDir();
  const vaultReal = realpathIfExists(vault);
  const vaultNorm = vaultReal ?? normalizeLexicalPath(vault);
  if (pathEqualsOrUnder(rp, vaultNorm)) return "blocked vault path";

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
    return assertDeniedSensitive(resolved);
  }

  // write
  if (!existsSync(resolved)) {
    const parent = dirname(resolved);
    if (existsSync(parent)) {
      const err = assertDeniedSensitive(parent);
      if (err) return err;
    } else {
      // Parent missing: still block obvious forbidden prefixes (e.g. /etc/foo/new)
      const err = assertDeniedSensitive(resolved);
      if (err) return err;
    }
    return null;
  }

  const readErr = assertDeniedSensitive(resolved);
  if (readErr) return readErr;
  return null;
}
