import type { FrontendManifest } from "./manifest.ts";

export type WindowKind = "overlay" | "settings" | "browser" | "coding" | "pomodoro-float";

export type DesktopWindowSpec = {
  id: string;
  kind: WindowKind;
  width: number;
  height: number;
  minWidth?: number;
  minHeight?: number;
  title?: string;
  transparent?: boolean;
  frame?: boolean;
  alwaysOnTop?: boolean;
  resizable?: boolean;
};

export type BundledSpaDesktopProfile = {
  embedMode: "bundled-spa";
  distSubdir: string;
  entryPath: string;
  defaultPath?: string;
  windows: DesktopWindowSpec[];
  defaultPort?: number;
};

/** Portal 内嵌伴侣浮层（VRM overlay WebView；非独立 Node 进程） */
export type EmbeddedOverlayDesktopProfile = {
  embedMode: "embedded-overlay";
  distSubdir: string;
  windows: DesktopWindowSpec[];
  defaultPort: number;
  portAttempts: number;
};

export type DesktopProfile = BundledSpaDesktopProfile | EmbeddedOverlayDesktopProfile;

export type MobileProfile = {
  embedMode: "bundled-spa" | "unsupported";
  distSubdir?: string;
};

export type FrontendDesktopExport = {
  manifest: FrontendManifest;
  profile: DesktopProfile;
};

export type FrontendMobileExport = {
  manifest: FrontendManifest;
  profile: MobileProfile;
};
