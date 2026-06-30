/** ui-kit 不依赖 shell-sdk；本地最小 Window 扩展供 layout 使用 */
export type WindowWithSatelliteShell = Omit<Window, "satelliteShell"> & {
  satelliteShell?: { isNativeShell?: boolean };
};

export function windowWithSatelliteShell(): WindowWithSatelliteShell {
  return window as WindowWithSatelliteShell;
}
