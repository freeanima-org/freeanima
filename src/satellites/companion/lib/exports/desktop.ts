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

/** @deprecated attach 在 overlay；no-op */
export { reconnectRemoteTools as reconnectCompanionSap } from "../../server/sap/hub.ts";
/** @deprecated attach 在 overlay；no-op */
export { reconnectRemoteTools as reconnectCompanionRemoteTools } from "../../server/sap/hub.ts";
/** @deprecated 始终 false；状态见 ShellApi.getCompanionRemoteToolsStatus */
export { isRemoteToolsConnected as isCompanionSapConnected } from "../../server/sap/hub.ts";
/** @deprecated 始终 false；状态见 ShellApi.getCompanionRemoteToolsStatus */
export { isRemoteToolsConnected as isCompanionRemoteToolsConnected } from "../../server/sap/hub.ts";

/** @deprecated server runtime 仅 browser-dev 遗留；Electron 用 overlay 本地 runtime */
export { advanceBubble, bubbleState } from "../../server/runtime-state.ts";
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
