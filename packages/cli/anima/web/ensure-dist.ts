import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { getInstallContext } from "../install-context.ts";

/** 用于评估 monorepo Web dist 是否齐全/过期（启动不会据此自动 build） */
export const WEB_DIST_REQUIRED_FILES = ["index.html"] as const;

/** PWA 产物（可选；FREEANIMA_WEB_SKIP_PWA=1 时可不存在） */
export const WEB_DIST_PWA_FILES = ["manifest.webmanifest", "sw.js"] as const;

/** 与 Vite shellEntryFileNames 产出一致 */
const SHELL_BRIDGE_ASSET_PREFIX = "shell-bridge-";

/** 缺失 shell-bridge 产物时在 missing 中使用的占位标识 */
export const SHELL_BRIDGE_DIST_MARKER = "assets/shell-bridge-*.js";

const SKIP_DIR_NAMES = new Set([".git", ".vite-app-web", "dist", "node_modules"]);

/** 影响 Web 静态产物的源码目录（相对 monorepo 根） */
export const WEB_SOURCE_WATCH_DIRS = [
  "packages/frontend/portal/app/web",
  "packages/frontend/client/portal-sdk",
  "packages/frontend/client/app-frame",
  "packages/frontend/ui-kit",
  "packages/shared",
  "packages/shared/rpc-contract",
  "packages/frontend/features/habitat/ui/habitat",
  "packages/frontend/features/chat/ui/spa",
  "packages/frontend/features/task/ui/spa",
  "packages/frontend/features/vault/ui/spa",
  "packages/frontend/features/companion/ui/spa",
  "messages/en.json",
  "messages/zh-cn.json",
] as const;

export type WebDistBuildAssessment = {
  /** monorepo 安装且 dist 缺失或落后于源码 */
  needsRebuild: boolean;
  missing: string[];
  stale: boolean;
  distDir: string | null;
};

export function isMonorepoWebInstall(): boolean {
  return getInstallContext().monorepoRoot != null;
}

export function hasShellBridgeAsset(distDir: string): boolean {
  const assetsDir = join(distDir, "assets");
  if (!existsSync(assetsDir)) return false;
  return readdirSync(assetsDir).some(
    (name) => name.startsWith(SHELL_BRIDGE_ASSET_PREFIX) && name.endsWith(".js"),
  );
}

function listMissingDistFiles(distDir: string): string[] {
  const missing: string[] = WEB_DIST_REQUIRED_FILES.filter(
    (name) => !existsSync(join(distDir, name)),
  );
  if (!hasShellBridgeAsset(distDir)) {
    missing.push(SHELL_BRIDGE_DIST_MARKER);
  }
  return missing;
}

/** 目录树（或单文件）内是否存在 mtime 晚于 sinceMs 的源文件 */
export function isSourceTreeNewerThan(root: string, sinceMs: number): boolean {
  let rootStat;
  try {
    rootStat = statSync(root);
  } catch {
    return false;
  }
  if (rootStat.isFile()) return rootStat.mtimeMs > sinceMs;
  if (!rootStat.isDirectory()) return false;

  const stack = [root];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) continue;
    let entries;
    try {
      entries = readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const path = join(current, entry.name);
      if (entry.isDirectory()) {
        if (SKIP_DIR_NAMES.has(entry.name)) continue;
        stack.push(path);
        continue;
      }
      if (!entry.isFile()) continue;
      try {
        if (statSync(path).mtimeMs > sinceMs) return true;
      } catch {
        /* ignore race */
      }
    }
  }
  return false;
}

export function assessMonorepoWebDist(
  monorepoRoot: string,
  distDir: string | null,
): WebDistBuildAssessment {
  if (!distDir) {
    return {
      needsRebuild: true,
      missing: [...WEB_DIST_REQUIRED_FILES, SHELL_BRIDGE_DIST_MARKER],
      stale: false,
      distDir: null,
    };
  }

  const missing = listMissingDistFiles(distDir);
  if (missing.length > 0) {
    return { needsRebuild: true, missing, stale: false, distDir };
  }

  let distMtimeMs: number;
  try {
    distMtimeMs = statSync(join(distDir, "index.html")).mtimeMs;
  } catch {
    return {
      needsRebuild: true,
      missing: ["index.html"],
      stale: false,
      distDir,
    };
  }

  for (const rel of WEB_SOURCE_WATCH_DIRS) {
    const sourceRoot = join(monorepoRoot, rel);
    if (!existsSync(sourceRoot)) continue;
    if (isSourceTreeNewerThan(sourceRoot, distMtimeMs)) {
      return { needsRebuild: true, missing: [], stale: true, distDir };
    }
  }

  return { needsRebuild: false, missing: [], stale: false, distDir };
}
