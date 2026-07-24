/** Rollup entryFileNames：shell-bridge 与主入口均带 content hash */
export function shellEntryFileNames(chunkInfo: { name?: string }): string {
  if (chunkInfo.name === "shell-bridge") return "assets/shell-bridge-[hash].js";
  return "assets/[name]-[hash].js";
}

/** dist 内 shell-bridge 产物文件名前缀 */
export const SHELL_BRIDGE_ASSET_PREFIX = "shell-bridge-";
