import type { FrontendManifest } from "./manifest.ts";

export type WindowKind = "overlay" | "settings" | "browser";

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

export type EmbeddedSidecarDesktopProfile = {
  embedMode: "embedded-sidecar";
  distSubdir: string;
  windows: DesktopWindowSpec[];
  defaultPort: number;
  portAttempts: number;
};

export type DesktopProfile = BundledSpaDesktopProfile | EmbeddedSidecarDesktopProfile;

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
