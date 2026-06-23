import type { FrontendDesktopExport } from "@freeanima/satellite-sdk";

import { startCompanionServer } from "../../server/index.ts";
import {
  COMPANION_WINDOW_HEIGHT,
  COMPANION_WINDOW_WIDTH,
  SATELLITE_PORT_ATTEMPTS,
  SATELLITE_PORT_START,
  SETTINGS_WINDOW_HEIGHT,
  SETTINGS_WINDOW_HEIGHT_WIN,
  SETTINGS_WINDOW_WIDTH,
  SETTINGS_WINDOW_WIDTH_WIN,
} from "../../shared/constants.ts";
import { getCompanionManifest } from "./manifest.ts";

export { startCompanionServer };
export type { CompanionServerHandle } from "../../server/index.ts";

export const companionDesktopExport: FrontendDesktopExport = {
  manifest: getCompanionManifest(),
  profile: {
    connectionKind: "embedded-sidecar",
    embedMode: "embedded-sidecar",
    distSubdir: "companion",
    defaultPort: SATELLITE_PORT_START,
    portAttempts: SATELLITE_PORT_ATTEMPTS,
    windows: [
      {
        id: "overlay",
        kind: "overlay",
        width: COMPANION_WINDOW_WIDTH,
        height: COMPANION_WINDOW_HEIGHT,
        transparent: true,
        frame: false,
        alwaysOnTop: true,
        resizable: false,
        title: "",
      },
      {
        id: "settings",
        kind: "settings",
        width: SETTINGS_WINDOW_WIDTH,
        height: SETTINGS_WINDOW_HEIGHT,
        minWidth: SETTINGS_WINDOW_WIDTH,
        minHeight: Math.round(SETTINGS_WINDOW_HEIGHT * 0.75),
        title: "FreeAnima Companion 设置",
        frame: true,
        resizable: true,
      },
    ],
  },
};

/** Windows 设置窗尺寸 */
export function companionSettingsWindowSizeWin(): { width: number; height: number } {
  return { width: SETTINGS_WINDOW_WIDTH_WIN, height: SETTINGS_WINDOW_HEIGHT_WIN };
}
