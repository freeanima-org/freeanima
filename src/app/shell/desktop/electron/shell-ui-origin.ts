/** Desktop 主窗口 UI 来源：Hub `/web`（默认）或本地 bundled static */
export type DesktopUiMode = "remote" | "bundled";

export function resolveDesktopUiMode(): DesktopUiMode {
  const raw = process.env.DESKTOP_UI_MODE?.trim().toLowerCase();
  return raw === "bundled" ? "bundled" : "remote";
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
