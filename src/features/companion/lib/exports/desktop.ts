import type { FrontendDesktopExport } from "@freeanima/client/portal-sdk";
import { getShellBuildTarget } from "@freeanima/client/portal-sdk/shell-build-target.ts";

import { startCompanionServer } from "../../server/index.ts";
import {
  COMPANION_WINDOW_HEIGHT,
  COMPANION_WINDOW_WIDTH,
  COMPANION_PORT_ATTEMPTS,
  COMPANION_PORT_START,
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

/** 仅 desktop 壳产物暴露 companion desktop export；其它 target 返回 null。 */
export function getCompanionDesktopExport(): FrontendDesktopExport | null {
  if (getShellBuildTarget() !== "desktop") return null;
  return companionDesktopExport;
}

export const companionDesktopExport: FrontendDesktopExport = {
  manifest: getCompanionManifest(),
  profile: {
    embedMode: "embedded-overlay",
    distSubdir: "companion",
    defaultPort: COMPANION_PORT_START,
    portAttempts: COMPANION_PORT_ATTEMPTS,
    windows: [
      {
        id: "overlay",
        kind: "overlay",
        // 元数据占位：运行时由壳 fit 为工作区全屏；数值为角色 footprint
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
