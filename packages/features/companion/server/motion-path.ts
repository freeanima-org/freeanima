import { existsSync, statSync } from "node:fs";
import { basename, join } from "node:path";
import { companionPackageRoot } from "./companion-root.ts";
import { companionMotionsDir } from "./paths.ts";

export function publicMotionsDir(): string {
  return join(companionPackageRoot(), "public", "motions");
}

function resolveMotionInDir(dir: string, name: string): string | null {
  const direct = join(dir, name);
  if (existsSync(direct) && statSync(direct).isFile()) {
    return direct;
  }
  const nested = join(dir, "vrma", name);
  if (existsSync(nested) && statSync(nested).isFile()) {
    return nested;
  }
  return null;
}

/** 用户数据目录 → 开发 public 回退 */
export function resolveMotionsSearchDirs(): string[] {
  const dirs = [companionMotionsDir(), publicMotionsDir()];
  return dirs.filter((dir, index) => dirs.indexOf(dir) === index);
}

/** 本地 cache 静态文件解析（不依赖 Habitat 导入管线） */
export function resolveMotionFile(relativePath: string): string | null {
  const rawName = basename(relativePath);
  let name: string;
  try {
    name = decodeURIComponent(rawName);
  } catch {
    name = rawName;
  }
  if (!name.endsWith(".vrma")) return null;

  for (const dir of resolveMotionsSearchDirs()) {
    const found = resolveMotionInDir(dir, name);
    if (found) return found;
  }
  return null;
}
