import { readAppVersion } from "./version.ts";

/**
 * 构建期版本：优先 `FREEANIMA_BUILD_VERSION`（CI canary/release 注入），
 * 否则读根 package.json（不改写该文件）。
 */
export function resolveBuildVersionFromEnv(
  repoRoot?: string,
  env: NodeJS.ProcessEnv = process.env,
): string {
  const fromEnv = env.FREEANIMA_BUILD_VERSION?.trim();
  if (fromEnv) return fromEnv.replace(/^v/i, "");
  return readAppVersion(repoRoot);
}
