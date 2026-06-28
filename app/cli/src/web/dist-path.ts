import { existsSync } from "node:fs";
import { join } from "node:path";
import { getInstallContext } from "../satellite-launch.ts";

const DIST_CANDIDATES = ["vendor/app-web/dist", "web/dist", "app/web/dist"] as const;

/** monorepo 内 Web dist 目录（不存在时返回 null） */
export function resolveMonorepoWebDistDir(monorepoRoot: string): string | null {
  const dist = join(monorepoRoot, "app/web/dist");
  if (existsSync(join(dist, "index.html"))) return dist;
  return null;
}

/** 解析 Web 静态产物目录（monorepo / npm 发布包） */
export function resolveWebDistDir(explicit?: string): string {
  if (explicit) {
    const dir = explicit.trim();
    if (!existsSync(join(dir, "index.html"))) {
      throw new Error(`Web dist 不存在或缺少 index.html: ${dir}`);
    }
    return dir;
  }

  const { monorepoRoot, cliRoot } = getInstallContext();

  if (monorepoRoot) {
    const monorepoDist = resolveMonorepoWebDistDir(monorepoRoot);
    if (monorepoDist) return monorepoDist;
  }

  const roots = [monorepoRoot, cliRoot].filter((r): r is string => r != null);

  for (const root of roots) {
    for (const rel of DIST_CANDIDATES) {
      const dist = join(root, rel);
      if (existsSync(join(dist, "index.html"))) return dist;
    }
  }

  throw new Error("未找到 Web dist。请在 monorepo 运行: bun run --filter @freeanima/app-web build");
}
