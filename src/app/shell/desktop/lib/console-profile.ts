import type { FrontendDesktopExport } from "@freeanima/frontend/shell-sdk";
import type { FrontendManifest } from "@freeanima/frontend/shell-sdk";
import { readMonorepoVersion } from "@freeanima/frontend/shell-sdk/version";

const APP_ID = "console";

export const CONSOLE_DEFAULT_PATH = "/console/dashboard";

export const consoleManifest: FrontendManifest = {
  appId: APP_ID,
  displayName: "管理台",
  version: readMonorepoVersion(),
  supportsDesktop: true,
  supportsMobile: true,
};

export function getConsoleManifest(): FrontendManifest {
  return { ...consoleManifest, version: readMonorepoVersion() };
}

export const CONSOLE_STATIC_PORT = 4175;
export const CONSOLE_STATIC_PORT_ATTEMPTS = 10;

export const consoleDesktopExport: FrontendDesktopExport = {
  manifest: getConsoleManifest(),
  profile: {
    embedMode: "bundled-spa",
    distSubdir: "console",
    entryPath: "index.html",
    defaultPath: CONSOLE_DEFAULT_PATH,
    defaultPort: CONSOLE_STATIC_PORT,
    windows: [],
  },
};
