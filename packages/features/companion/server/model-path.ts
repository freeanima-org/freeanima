import { existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { companionModelsDir, publicModelsDir } from "./paths.ts";

/** 配置中的占位路径；仓库不捆绑对应文件 */
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

  const publicPath = join(publicModelsDir(), name);
  if (existsSync(publicPath) && statSync(publicPath).isFile()) {
    return publicPath;
  }

  return null;
}

export function isModelPathAvailable(modelPath: string): boolean {
  if (!modelPath.trim()) return false;
  return resolveModelFile(modelPath) != null;
}
