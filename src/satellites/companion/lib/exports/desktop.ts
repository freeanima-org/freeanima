import type { FrontendDesktopExport } from "@freeanima/frontend/shell-sdk";

import { startCompanionServer } from "../../server/index.ts";
import {
  COMPANION_WINDOW_HEIGHT,
  COMPANION_WINDOW_WIDTH,
  SATELLITE_PORT_ATTEMPTS,
  SATELLITE_PORT_START,
  SETTINGS_WINDOW_HEIGHT_WIN,
  SETTINGS_WINDOW_WIDTH_WIN,
} from "../../shared/constants.ts";
import { getCompanionManifest } from "./manifest.ts";

export { startCompanionServer };
export type { CompanionServerHandle } from "../../server/index.ts";

export {
  addRuntimeExternalListener,
  runtimeWsPayload,
  type RuntimeWsMessage,
} from "../../server/runtime-ws.ts";

export const companionDesktopExport: FrontendDesktopExport = {
  manifest: getCompanionManifest(),
  profile: {
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
    ],
  },
};

/** Windows 设置窗尺寸 */
export function companionSettingsWindowSizeWin(): { width: number; height: number } {
  return { width: SETTINGS_WINDOW_WIDTH_WIN, height: SETTINGS_WINDOW_HEIGHT_WIN };
}
