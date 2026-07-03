import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { getInstallContext } from "../satellite-launch.ts";
import { resolveMonorepoWebDistDir } from "./dist-path.ts";

/** npm 发布包内置 dist；monorepo 开发需本地 build */
export const WEB_DIST_REQUIRED_FILES = ["index.html", "manifest.webmanifest", "sw.js"] as const;

/** 与 Vite shellEntryFileNames 产出一致 */
const SHELL_BRIDGE_ASSET_PREFIX = "shell-bridge-";

/** 缺失 shell-bridge 产物时在 missing 中使用的占位标识 */
export const SHELL_BRIDGE_DIST_MARKER = "assets/shell-bridge-*.js";

const SKIP_DIR_NAMES = new Set([".git", ".vite-app-web", "dist", "node_modules"]);

/** 影响 Web 静态产物的源码目录（相对 monorepo 根） */
export const WEB_SOURCE_WATCH_DIRS = [
  "app/web",
  "frontend/shell-ui",
  "shared/sap-contract/src",
  "features/console/ui/admin",
  "features/chat/ui/app",
  "features/task/ui/app",
  "features/vault/ui/app",
  "satellites/pair-programming/app",
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

/** 目录树内是否存在 mtime 晚于 sinceMs 的源文件 */
export function isSourceTreeNewerThan(root: string, sinceMs: number): boolean {
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

export async function runMonorepoWebBuild(monorepoRoot: string): Promise<void> {
  const proc = Bun.spawn({
    cmd: ["bun", "run", "--filter", "@freeanima/app-web", "build"],
    cwd: monorepoRoot,
    stdout: "inherit",
    stderr: "inherit",
  });
  const code = await proc.exited;
  if (code !== 0) {
    throw new Error(
      `Web build 失败 (exit ${code})。请手动运行: bun run --filter @freeanima/app-web build`,
    );
  }
}

export type EnsureWebDistOptions = {
  /** 显式 dist 目录时跳过检测 */
  dist?: string;
  /** 跳过自动 build（CLI --skip-build 或 FREEANIMA_WEB_SKIP_BUILD=1） */
  skipBuild?: boolean;
};

/** monorepo 启动 Web 前：缺失或源码更新则自动 build；npm 包跳过 */
export async function ensureWebDistBuilt(opts: EnsureWebDistOptions = {}): Promise<void> {
  if (opts.dist || opts.skipBuild || process.env.FREEANIMA_WEB_SKIP_BUILD === "1") {
    return;
  }

  const { monorepoRoot } = getInstallContext();
  if (!monorepoRoot) return;

  const distDir = resolveMonorepoWebDistDir(monorepoRoot);
  const assessment = assessMonorepoWebDist(monorepoRoot, distDir);
  if (!assessment.needsRebuild) return;

  if (assessment.missing.length > 0) {
    console.log(`[web] 缺少静态产物: ${assessment.missing.join(", ")}`);
  } else if (assessment.stale) {
    console.log("[web] 源码已更新，正在重新 build Web 静态产物…");
  } else {
    console.log("[web] 未找到 Web dist，正在 build…");
  }

  await runMonorepoWebBuild(monorepoRoot);
}
