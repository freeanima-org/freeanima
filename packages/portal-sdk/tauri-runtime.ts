/** Tauri WebView 运行时探测（不依赖 @tauri-apps/api 静态 import） */

type TauriWindow = Window & {
  __TAURI_INTERNALS__?: unknown;
  __TAURI__?: unknown;
  isTauri?: boolean;
};

function runtimeWindow(): TauriWindow | undefined {
  if (typeof window !== "undefined") return window;
  return (globalThis as { window?: TauriWindow }).window;
}

/**
 * 是否在 Tauri WebView 内（portalShell 注入前也可用）。
 * - IPC / withGlobalTauri 全局
 * - 自定义协议与 Tauri 2 默认主机名（含 *.localhost，排除光杆 localhost）
 */
export function isTauriRuntime(): boolean {
  const w = runtimeWindow();
  if (!w) return false;
  if (w.portalShell?.isTauri) return true;
  if (w.__TAURI_INTERNALS__ || w.__TAURI__ || w.isTauri) return true;
  try {
    const { protocol, hostname } = w.location;
    if (protocol === "tauri:") return true;
    if (hostname === "tauri.localhost" || hostname === "ipc.localhost") return true;
    // Tauri 2 自定义协议常见 *.localhost
    if (hostname.endsWith(".localhost") && hostname !== "localhost") return true;
  } catch {
    /* ignore */
  }
  return false;
}

/**
 * 桌面 vs 移动 Tauri：只认移动 UA。
 * 禁止用 maxTouchPoints——Windows 触屏笔记本常 >0，会误走 mobile bootstrap。
 */
export function isTauriMobileUserAgent(): boolean {
  const w = runtimeWindow();
  const ua = w?.navigator?.userAgent ?? "";
  return /Android|iPhone|iPad/i.test(ua);
}
