/** desktop / web 支持右键菜单；mobile 壳层不启用 */
export function isTaskContextMenuEnabled(): boolean {
  return typeof window !== "undefined" && !window.satelliteShell?.isNativeShell;
}
