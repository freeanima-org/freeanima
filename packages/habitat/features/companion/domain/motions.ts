import { existsSync, statSync } from "node:fs";
import { basename, join } from "node:path";
import { companionMotionsDir } from "./paths.ts";
import { requiredMotionFiles } from "./motion-manifest.ts";

export const REQUIRED_MOTION_FILES = requiredMotionFiles();

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

export function resolveMotionsSearchDirs(): string[] {
  return [companionMotionsDir()];
}

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

export function motionsReady(dir: string): boolean {
  if (!existsSync(dir)) return false;
  return REQUIRED_MOTION_FILES.every((motionName) => resolveMotionInDir(dir, motionName) != null);
}
