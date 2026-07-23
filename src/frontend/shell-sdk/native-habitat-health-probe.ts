import type { HabitatHealthBody } from "./habitat-health-probe.ts";

function habitatOrigin(habitatUrl: string): string {
  try {
    const withScheme = /^https?:\/\//i.test(habitatUrl.trim())
      ? habitatUrl.trim()
      : `http://${habitatUrl.trim()}`;
    return new URL(withScheme.replace(/\/$/, "")).origin;
  } catch {
    return "";
  }
}

function isTauriShell(): boolean {
  return typeof window !== "undefined" && Boolean(window.satelliteShell?.isTauri);
}

/** Tauri 原生 HTTP：绕过 WebView CORS / AsyncDns（hosts 主机名） */
export async function probeHabitatHealthViaNativeHttp(
  url: string,
  headers: Record<string, string>,
  timeoutMs: number,
): Promise<HabitatHealthBody> {
  if (!isTauriShell()) {
    throw new Error("原生 HTTP 探测不可用（非 Tauri 壳）");
  }
  const { invoke } = await import("@tauri-apps/api/core");
  const rawAuth = headers.authorization ?? headers.Authorization ?? "";
  const token = rawAuth.replace(/^Bearer\s+/i, "").trim();
  return invoke<HabitatHealthBody>("probe_habitat_health", {
    url,
    token: token || null,
    timeoutMs,
  });
}

/** 是否走 Tauri 原生 health 探测（跨 origin 时） */
export async function shouldProbeHabitatHealthViaNativeHttp(habitatUrl: string): Promise<boolean> {
  if (!isTauriShell()) return false;
  const page = window.location.origin;
  const origin = habitatOrigin(habitatUrl);
  if (page && origin && page === origin) return false;
  return true;
}
