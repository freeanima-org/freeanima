/** Hub REST 根（bundled UI 跨 origin 时读 satelliteShell.hubUrl） */
export function resolveApiOrigin(): string {
  if (typeof window === "undefined") return "http://127.0.0.1:2658";
  const hub = window.satelliteShell?.hubUrl?.replace(/\/$/, "");
  return hub ?? window.location.origin;
}
