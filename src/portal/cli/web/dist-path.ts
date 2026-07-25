import { existsSync } from "node:fs";
import { join } from "node:path";
import { getInstallContext } from "../install-context.ts";
import { getRegisteredEmbeddedWebDist, materializeEmbeddedWebDist } from "./web-dist-embedded.ts";

const DIST_CANDIDATES = ["src/portal/app/web/dist"] as const;

/** monorepo 内 Web dist 目录（不存在时返回 null） */
export function resolveMonorepoWebDistDir(monorepoRoot: string): string | null {
  const dist = join(monorepoRoot, "src/portal/app/web/dist");
  if (existsSync(join(dist, "index.html"))) return dist;
  return null;
}

/** 解析 Web 静态产物目录；缺失时返回 null（不抛） */
export function tryResolveWebDistDir(explicit?: string): string | null {
  if (explicit) {
    const dir = explicit.trim();
    if (!existsSync(join(dir, "index.html"))) return null;
    return dir;
  }

  const embedded = getRegisteredEmbeddedWebDist();
  if (embedded) {
    const dir = materializeEmbeddedWebDist(embedded);
    if (existsSync(join(dir, "index.html"))) return dir;
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

  return null;
}

/** 解析 Web 静态产物目录（monorepo / npm 发布包）；缺失时抛错 */
export function resolveWebDistDir(explicit?: string): string {
  const dist = tryResolveWebDistDir(explicit);
  if (dist) return dist;
  if (explicit?.trim()) {
    throw new Error(`Web dist 不存在或缺少 index.html: ${explicit.trim()}`);
  }
  throw new Error("未找到 Web dist。请在仓库根目录运行: just pack web");
}
