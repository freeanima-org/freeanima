import type { FrontendDesktopExport } from "@freeanima/client/portal-sdk";
import { getShellBuildTarget } from "@freeanima/client/portal-sdk/shell-build-target.ts";

import {
  POMODORO_FLOAT_PORT_START,
  POMODORO_FLOAT_WINDOW_HEIGHT,
  POMODORO_FLOAT_WINDOW_WIDTH,
} from "../../shared/float-constants.ts";
import { getPomodoroFloatManifest } from "./float-manifest.ts";

/** 仅 desktop 壳产物暴露番茄迷你窗 export。 */
export function getPomodoroFloatDesktopExport(): FrontendDesktopExport | null {
  if (getShellBuildTarget() !== "desktop") return null;
  return pomodoroFloatDesktopExport;
}

export const pomodoroFloatDesktopExport: FrontendDesktopExport = {
  manifest: getPomodoroFloatManifest(),
  profile: {
    embedMode: "bundled-spa",
    distSubdir: "pomodoro-float",
    entryPath: "index.html",
    defaultPort: POMODORO_FLOAT_PORT_START,
    windows: [
      {
        id: "main",
        kind: "pomodoro-float",
        width: POMODORO_FLOAT_WINDOW_WIDTH,
        height: POMODORO_FLOAT_WINDOW_HEIGHT,
        transparent: false,
        frame: false,
        alwaysOnTop: true,
        resizable: false,
        title: "番茄钟",
      },
    ],
  },
};
