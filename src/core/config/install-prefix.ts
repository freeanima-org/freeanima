import { dirname, join, normalize, resolve } from "node:path";

import { isStandaloneExecutable } from "./cli-install.ts";
import { PATHS } from "./paths.ts";
import { resolveMonorepoRoot } from "./repo-root.ts";

export {
  animaBinShimPath,
  currentAnimaLinkPath,
  defaultAnimaBinDir,
  getCurrentVersionId,
  installVersionedBinary,
  legacyAnimaBinShimPath,
  listInstalledVersions,
  MAX_KEPT_STANDALONE_VERSIONS,
  migrateFlatAnimaFileIfNeeded,
  normalizeVersionFileId,
  parseVersionIdFromFileName,
  pruneVersionedBinaries,
  relinkPathShim,
  removeLegacyAnimaBinShim,
  resolveStableStandaloneAnimaPath,
  setCurrentVersion,
  versionedAnimaFileName,
  versionedAnimaPath,
  type InstalledStandaloneVersion,
} from "./standalone-versions.ts";

/** 默认独立安装前缀（非 monorepo、非 dist staging） */
export function defaultStandaloneInstallPrefix(home = PATHS.home): string {
  return join(home, "standalone");
}

export function resolveInstallPrefixFromEnv(
  env: NodeJS.ProcessEnv = process.env,
  home = PATHS.home,
): string {
  const fromEnv = env.FREEANIMA_INSTALL_PREFIX?.trim();
  if (fromEnv) return resolve(fromEnv);
  return defaultStandaloneInstallPrefix(home);
}

/** monorepo 根（package name `freeanima`），含其下任意路径 */
export function isPathInsideMonorepo(
  targetPath: string,
  monorepoRoot: string | null = resolveMonorepoRoot(process.cwd()),
): boolean {
  if (!monorepoRoot) return false;
  const root = normalize(resolve(monorepoRoot));
  const target = normalize(resolve(targetPath));
  return target === root || target.startsWith(`${root}/`);
}

/**
 * 安装/upgrade 前缀不得落在 monorepo 内（含 `dist/anima-executable`）。
 */
export function assertSafeStandaloneInstallPrefix(
  prefix: string,
  opts?: { monorepoRoot?: string | null; cwd?: string },
): void {
  const resolved = resolve(prefix);
  const monorepoRoot =
    opts?.monorepoRoot !== undefined
      ? opts.monorepoRoot
      : resolveMonorepoRoot(opts?.cwd ?? process.cwd());
  if (isPathInsideMonorepo(resolved, monorepoRoot)) {
    throw new Error(
      `拒绝安装到 monorepo 内（${resolved}）。请设置 FREEANIMA_INSTALL_PREFIX 或 just install-cli 装到独立前缀（默认 ~/.anima/standalone）。`,
    );
  }
}

/**
 * standalone 安装前缀 = 可执行文件所在目录（`anima` / `anima_<ver>` 同目录）。
 * 当前进程为 standalone 时用之。
 */
export function resolveStandalonePrefixFromExec(execPath: string): string | null {
  if (isStandaloneExecutable()) {
    return dirname(execPath);
  }
  void execPath;
  return null;
}
