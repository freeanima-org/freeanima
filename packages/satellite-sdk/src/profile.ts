import type { ConnectionKind, FrontendManifest } from "./manifest.ts";

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

export type HubRestBundledDesktopProfile = {
  connectionKind: "hub-rest";
  embedMode: "bundled-spa";
  distSubdir: string;
  entryPath: string;
  defaultPath: string;
  windows: DesktopWindowSpec[];
  defaultPort?: number;
};

export type SapDirectDesktopProfile = {
  connectionKind: "sap-direct";
  embedMode: "bundled-spa";
  distSubdir: string;
  entryPath: string;
  windows: DesktopWindowSpec[];
  defaultPort?: number;
};

export type EmbeddedSidecarDesktopProfile = {
  connectionKind: "embedded-sidecar";
  embedMode: "embedded-sidecar";
  distSubdir: string;
  windows: DesktopWindowSpec[];
  defaultPort: number;
  portAttempts: number;
};

export type DesktopProfile =
  | HubRestBundledDesktopProfile
  | SapDirectDesktopProfile
  | EmbeddedSidecarDesktopProfile;

export type MobileProfile = {
  connectionKind: ConnectionKind;
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
