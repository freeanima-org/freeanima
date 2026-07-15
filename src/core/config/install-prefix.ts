import { dirname, join, normalize, resolve } from "node:path";

import { isStandaloneExecutable } from "./cli-install.ts";
import { PATHS } from "./paths.ts";
import { resolveMonorepoRoot } from "./repo-root.ts";

/** 默认独立安装前缀（非 monorepo、非 dist staging） */
export function defaultStandaloneInstallPrefix(home = PATHS.home): string {
  return join(home, "standalone");
}

/** PATH 入口目录（`~/.anima/bin`） */
export function defaultAnimaBinDir(home = PATHS.home): string {
  return join(home, "bin");
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
 * standalone 安装前缀 = 可执行文件所在目录。
 * 当前进程为 standalone 时用之；否则若明确传入已安装的 anima 路径也取其 dirname。
 */
export function resolveStandalonePrefixFromExec(execPath: string): string | null {
  if (isStandaloneExecutable()) {
    return dirname(execPath);
  }
  // 非 standalone 进程：无法可靠判断 path 是否为编译产物，返回 null
  void execPath;
  return null;
}

export function animaBinShimPath(binDir = defaultAnimaBinDir()): string {
  return join(binDir, "anima");
}
