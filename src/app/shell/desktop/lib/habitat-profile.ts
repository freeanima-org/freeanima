import type { FrontendDesktopExport } from "@freeanima/frontend/shell-sdk";
import type { FrontendManifest } from "@freeanima/frontend/shell-sdk";
import { readMonorepoVersion } from "@freeanima/frontend/shell-sdk/version";

const APP_ID = "habitat";

export const HABITAT_DEFAULT_PATH = "/habitat/dashboard";

export const habitatManifest: FrontendManifest = {
  appId: APP_ID,
  displayName: "栖息地",
  version: readMonorepoVersion(),
  supportsDesktop: true,
  supportsMobile: true,
};

export function getHabitatManifest(): FrontendManifest {
  return { ...habitatManifest, version: readMonorepoVersion() };
}

export const HABITAT_STATIC_PORT = 4175;
export const HABITAT_STATIC_PORT_ATTEMPTS = 10;

export const habitatDesktopExport: FrontendDesktopExport = {
  manifest: getHabitatManifest(),
  profile: {
    embedMode: "bundled-spa",
    distSubdir: "habitat",
    entryPath: "index.html",
    defaultPath: HABITAT_DEFAULT_PATH,
    defaultPort: HABITAT_STATIC_PORT,
    windows: [],
  },
};
