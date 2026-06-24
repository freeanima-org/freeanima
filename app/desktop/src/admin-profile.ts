import type { FrontendDesktopExport } from "@freeanima/satellite-sdk";
import type { FrontendManifest } from "@freeanima/satellite-sdk";
import { readMonorepoVersion } from "@freeanima/satellite-sdk/version";

const APP_ID = "admin";

export const ADMIN_DEFAULT_PATH = "/admin/dashboard";

export const adminManifest: FrontendManifest = {
  appId: APP_ID,
  displayName: "管理台",
  version: readMonorepoVersion(),
  supportsDesktop: true,
  supportsMobile: true,
  connectionKind: "hub-rest",
};

export function getAdminManifest(): FrontendManifest {
  return { ...adminManifest, version: readMonorepoVersion() };
}

export const ADMIN_STATIC_PORT = 4175;
export const ADMIN_STATIC_PORT_ATTEMPTS = 10;

export const adminDesktopExport: FrontendDesktopExport = {
  manifest: getAdminManifest(),
  profile: {
    connectionKind: "hub-rest",
    embedMode: "bundled-spa",
    distSubdir: "admin",
    entryPath: "index.html",
    defaultPath: ADMIN_DEFAULT_PATH,
    defaultPort: ADMIN_STATIC_PORT,
    windows: [
      {
        id: "main",
        kind: "browser",
        width: 1100,
        height: 800,
        minWidth: 720,
        minHeight: 560,
        title: "FreeAnima 管理台",
        frame: true,
        resizable: true,
      },
    ],
  },
};
