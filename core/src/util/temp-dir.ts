import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve, sep } from "node:path";

/** Runtime session cwd / execute_code dirs under os.tmpdir() */
const RUNTIME_TMP_PREFIXES = ["anima-cwd-", "anima-exec-"] as const;

/** Common test-suite mkdtemp prefixes (integration + unit) */
const TEST_TMP_PREFIXES = [
  "anima-",
  "freeanima-",
  "companion-",
  "pp-ws-",
  "skill-dir-",
  "acp-client-methods-",
] as const;

const MANAGED_TMP_PREFIXES = [...RUNTIME_TMP_PREFIXES, ...TEST_TMP_PREFIXES] as readonly string[];

function isUnderTmpdir(path: string): boolean {
  const resolved = resolve(path);
  const base = resolve(tmpdir());
  return resolved === base || resolved.startsWith(`${base}${sep}`);
}

function matchesManagedPrefix(name: string): boolean {
  return MANAGED_TMP_PREFIXES.some((prefix) => name.startsWith(prefix));
}

/** Create a directory under os.tmpdir() with the given prefix (must end with `-` or similar for mkdtemp). */
export function createTempDir(prefix: string): string {
  return mkdtempSync(join(tmpdir(), prefix));
}

/** Remove a temp directory; ignores ENOENT. */
export function removeTempDir(path: string | undefined): void {
  if (!path) return;
  try {
    rmSync(path, { recursive: true, force: true });
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
  }
}

/** True when path is a known FreeAnima temp dir directly under os.tmpdir(). */
export function isManagedAnimaTmpPath(path: string): boolean {
  if (!path.trim()) return false;
  if (!isUnderTmpdir(path)) return false;
  const resolved = resolve(path);
  const base = resolve(tmpdir());
  if (dirname(resolved) !== base) return false;
  return matchesManagedPrefix(basename(resolved));
}

/** Remove path when it is a managed FreeAnima temp dir; returns whether removal was attempted. */
export function removeManagedAnimaTmpPath(path: string): boolean {
  if (!isManagedAnimaTmpPath(path)) return false;
  removeTempDir(path);
  return true;
}
