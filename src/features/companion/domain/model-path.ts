import { existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { companionModelsDir } from "./paths.ts";

/** 配置中的占位路径 */
export const PLACEHOLDER_MODEL_PATH = "/models/default.vrm";

export function resolveModelFile(relPath: string): string | null {
  const name = relPath.replace(/^\/models\//, "");
  if (!name || name.includes("..") || name.includes("/") || name.includes("\\")) {
    return null;
  }

  const userPath = join(companionModelsDir(), name);
  if (existsSync(userPath) && statSync(userPath).isFile()) {
    return userPath;
  }

  return null;
}

export function isModelPathAvailable(modelPath: string): boolean {
  if (!modelPath.trim()) return false;
  return resolveModelFile(modelPath) != null;
}
