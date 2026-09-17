/**
 * Standalone 多版本布局（扁平文件）：
 *   $PREFIX/anima_<id>   — 各版本二进制
 *   $PREFIX/anima        — 指向当前版本的 symlink
 * PATH shim（默认 ~/.local/bin/anima）→ $PREFIX/anima
 */
import {
  chmodSync,
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readlinkSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  symlinkSync,
  utimesSync,
} from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";

import { PATHS } from "./paths.ts";

export const MAX_KEPT_STANDALONE_VERSIONS = 7;

const VERSIONED_PREFIX = "anima_";

/** PATH 入口目录（`~/.local/bin`，与 FREEANIMA_HOME 解耦） */
export function defaultAnimaBinDir(userHome = homedir()): string {
  return join(userHome, ".local", "bin");
}

export function animaBinShimPath(binDir = defaultAnimaBinDir()): string {
  return join(binDir, "anima");
}

/** 旧布局 PATH shim（`$FREEANIMA_HOME/bin/anima`） */
export function legacyAnimaBinShimPath(animaHome = PATHS.home): string {
  return join(animaHome, "bin", "anima");
}

export function removeLegacyAnimaBinShim(animaHome = PATHS.home): void {
  rmSync(legacyAnimaBinShimPath(animaHome), { force: true });
}

/** 规范化为文件名安全的版本 id（去前导 v） */
export function normalizeVersionFileId(raw: string): string {
  let id = raw.trim();
  if (id.startsWith("v") || id.startsWith("V")) {
    const rest = id.slice(1);
    if (/^\d/.test(rest)) id = rest;
  }
  id = id.replaceAll(/[^A-Za-z0-9._+-]/g, "_");
  if (id.length === 0) id = "unknown";
  return id;
}

export function versionedAnimaFileName(versionId: string): string {
  return `${VERSIONED_PREFIX}${normalizeVersionFileId(versionId)}`;
}

export function versionedAnimaPath(prefix: string, versionId: string): string {
  return join(prefix, versionedAnimaFileName(versionId));
}

export function currentAnimaLinkPath(prefix: string): string {
  return join(prefix, "anima");
}

/** 从 `anima_<id>` 文件名解析 id；非版本文件返回 null */
export function parseVersionIdFromFileName(name: string): string | null {
  if (!name.startsWith(VERSIONED_PREFIX)) return null;
  const id = name.slice(VERSIONED_PREFIX.length);
  return id.length > 0 ? id : null;
}

export type InstalledStandaloneVersion = {
  id: string;
  path: string;
  mtimeMs: number;
};

export function listInstalledVersions(prefix: string): InstalledStandaloneVersion[] {
  if (!existsSync(prefix)) return [];
  const out: InstalledStandaloneVersion[] = [];
  for (const name of readdirSync(prefix)) {
    const id = parseVersionIdFromFileName(name);
    if (id == null) continue;
    const path = join(prefix, name);
    try {
      const st = statSync(path);
      if (!st.isFile()) continue;
      out.push({ id, path, mtimeMs: st.mtimeMs });
    } catch {
      /* skip */
    }
  }
  return out.toSorted((a, b) => b.mtimeMs - a.mtimeMs);
}

/** 解析 `$PREFIX/anima` 当前指向的版本 id（若可） */
export function getCurrentVersionId(prefix: string): string | null {
  const link = currentAnimaLinkPath(prefix);
  if (!existsSync(link)) return null;
  try {
    const st = lstatSync(link);
    if (st.isSymbolicLink()) {
      const target = readlinkSync(link);
      return parseVersionIdFromFileName(basename(target));
    }
    // 扁平普通文件：尚无版本化
    if (st.isFile()) return null;
  } catch {
    return null;
  }
  return null;
}

/** 将 `$PREFIX/anima` 指到 `anima_<id>`（相对 symlink）；并刷新 PATH shim */
export function setCurrentVersion(
  prefix: string,
  versionId: string,
  opts?: { binDir?: string; animaHome?: string },
): string {
  const id = normalizeVersionFileId(versionId);
  const targetName = versionedAnimaFileName(id);
  const targetPath = join(prefix, targetName);
  if (!existsSync(targetPath)) {
    throw new Error(`版本不存在: ${id}（期望 ${targetPath}）`);
  }
  mkdirSync(prefix, { recursive: true });
  const link = currentAnimaLinkPath(prefix);
  if (existsSync(link)) {
    const st = lstatSync(link);
    if (st.isFile() && !st.isSymbolicLink()) {
      throw new Error(
        `拒绝覆盖普通文件 ${link}；请先 migrateFlatAnimaFileIfNeeded 迁为 anima_<version>`,
      );
    }
  }
  rmSync(link, { force: true });
  symlinkSync(targetName, link);

  relinkPathShim(prefix, opts?.binDir);
  removeLegacyAnimaBinShim(opts?.animaHome);
  return link;
}

/** PATH shim → `$PREFIX/anima` */
export function relinkPathShim(prefix: string, binDir = defaultAnimaBinDir()): string {
  mkdirSync(binDir, { recursive: true });
  const shim = animaBinShimPath(binDir);
  const target = currentAnimaLinkPath(prefix);
  rmSync(shim, { force: true });
  symlinkSync(target, shim);
  return shim;
}

/**
 * 保留最多 maxKeep 个 `anima_*`；按 mtime 升序删最旧；永不删 current 指向的版本。
 * @returns 被删除的版本 id 列表
 */
export function pruneVersionedBinaries(
  prefix: string,
  maxKeep = MAX_KEPT_STANDALONE_VERSIONS,
): string[] {
  const current = getCurrentVersionId(prefix);
  const all = listInstalledVersions(prefix);
  if (all.length <= maxKeep) return [];

  const byOldest = all.toSorted((a, b) => a.mtimeMs - b.mtimeMs);
  const removed: string[] = [];
  for (const entry of byOldest) {
    if (all.length - removed.length <= maxKeep) break;
    if (current != null && entry.id === current) continue;
    rmSync(entry.path, { force: true });
    removed.push(entry.id);
  }
  return removed;
}

/**
 * 若 `$PREFIX/anima` 是普通文件（旧布局），迁为 `anima_<versionId>` 并设 symlink。
 * 已是 symlink 或已有版本文件则跳过迁文件（仍可补链）。
 */
export function migrateFlatAnimaFileIfNeeded(prefix: string, versionId: string): boolean {
  const link = currentAnimaLinkPath(prefix);
  if (!existsSync(link)) return false;
  let st;
  try {
    st = lstatSync(link);
  } catch {
    return false;
  }
  if (st.isSymbolicLink()) return false;
  if (!st.isFile()) return false;

  const id = normalizeVersionFileId(versionId);
  const dest = versionedAnimaPath(prefix, id);
  mkdirSync(prefix, { recursive: true });
  if (existsSync(dest)) {
    rmSync(dest, { force: true });
  }
  renameSync(link, dest);
  symlinkSync(versionedAnimaFileName(id), link);
  try {
    utimesSync(dest, new Date(), new Date());
  } catch {
    /* ignore */
  }
  return true;
}

/**
 * 安装/覆盖某一版本二进制，设为 current，刷新 PATH，修剪。
 * 旧扁平 `anima` 普通文件请先调用 {@link migrateFlatAnimaFileIfNeeded}。
 * @returns 版本化文件路径
 */
export function installVersionedBinary(
  prefix: string,
  stagedAnimaPath: string,
  versionId: string,
  opts?: { maxKeep?: number; binDir?: string; animaHome?: string },
): { versionPath: string; currentLink: string; pruned: string[] } {
  const id = normalizeVersionFileId(versionId);
  mkdirSync(prefix, { recursive: true });

  const dest = versionedAnimaPath(prefix, id);
  const destNew = `${dest}.new`;
  cpSync(stagedAnimaPath, destNew);
  chmodSync(destNew, 0o755);
  renameSync(destNew, dest);
  try {
    utimesSync(dest, new Date(), new Date());
  } catch {
    /* ignore */
  }

  // 清理旧旁路布局残留
  rmSync(join(prefix, "package.json"), { force: true });
  rmSync(join(prefix, "dist"), { recursive: true, force: true });
  rmSync(join(prefix, "anima.old"), { force: true });
  rmSync(join(prefix, "anima.new"), { force: true });

  const currentLink = setCurrentVersion(prefix, id, {
    ...(opts?.binDir ? { binDir: opts.binDir } : {}),
    ...(opts?.animaHome ? { animaHome: opts.animaHome } : {}),
  });
  const pruned = pruneVersionedBinaries(prefix, opts?.maxKeep ?? MAX_KEPT_STANDALONE_VERSIONS);
  return { versionPath: dest, currentLink, pruned };
}

/** 稳定 ExecStart 路径：优先 `$PREFIX/anima` */
export function resolveStableStandaloneAnimaPath(execPath: string): string {
  const prefix = dirname(resolve(execPath));
  const stable = currentAnimaLinkPath(prefix);
  if (existsSync(stable)) return stable;
  return execPath;
}
