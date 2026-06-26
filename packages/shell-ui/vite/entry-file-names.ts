/** Rollup entryFileNames：sidecar / shell 固定产物名 */
export function shellEntryFileNames(chunkInfo: { name?: string }): string {
  if (chunkInfo.name === "sap-shared-worker") return "sap-shared-worker.js";
  if (chunkInfo.name === "shell-bridge") return "shell-bridge.js";
  return "assets/[name]-[hash].js";
}
