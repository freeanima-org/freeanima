/** 将未读合计同步到应用图标角标（Shell / Web Badging API） */
export async function syncAppBadgeCount(count: number): Promise<void> {
  const n = Math.max(0, Math.floor(count));
  const shell = typeof window !== "undefined" ? window.portalShell : undefined;
  if (shell?.setAppBadgeCount) {
    try {
      await shell.setAppBadgeCount(n);
      return;
    } catch (e) {
      console.error("setAppBadgeCount:", e);
    }
  }
  const nav = typeof navigator !== "undefined" ? navigator : undefined;
  try {
    if (n > 0 && typeof nav?.setAppBadge === "function") {
      await nav.setAppBadge(n);
    } else if (n <= 0 && typeof nav?.clearAppBadge === "function") {
      await nav.clearAppBadge();
    }
  } catch {
    // Badging API 可能因权限 / 非 PWA 失败，忽略
  }
}

export async function requestShellAppAttention(): Promise<void> {
  const shell = typeof window !== "undefined" ? window.portalShell : undefined;
  if (!shell?.requestAppAttention) return;
  try {
    await shell.requestAppAttention();
  } catch (e) {
    console.error("requestAppAttention:", e);
  }
}
