/** Hub REST 根（bundled 客户端读 satelliteShell.hubUrl，直连 Hub） */
export function resolveApiOrigin(): string {
  if (typeof window === "undefined") return "http://127.0.0.1:2658";
  const hub = window.satelliteShell?.hubUrl?.replace(/\/$/, "");
  return hub ?? window.location.origin;
}
