/** Desktop 主窗口 UI 来源：本地 bundled（默认）或调试用远程 Hub `/web` */
export type DesktopUiMode = "local" | "remote";

export function resolveDesktopUiMode(): DesktopUiMode {
  const raw = process.env.DESKTOP_UI_MODE?.trim().toLowerCase();
  if (raw === "remote") return "remote";
  // 兼容旧 env：bundled → local
  return "local";
}

export function resolveRemoteShellUiBase(hubUrl: string): string {
  const override = process.env.DESKTOP_UI_URL?.replace(/\/$/, "");
  if (override) return override;
  return `${hubUrl.replace(/\/$/, "")}/web`;
}

export function shellUiPathToUrl(base: string, path: string): string {
  const root = base.replace(/\/$/, "");
  const rel = path.startsWith("/") ? path : `/${path}`;
  return `${root}${rel}`;
}
