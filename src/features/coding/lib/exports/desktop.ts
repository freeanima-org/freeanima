import type { FrontendDesktopExport } from "@freeanima/client/portal-sdk";
import { getShellBuildTarget } from "@freeanima/client/portal-sdk/shell-build-target.ts";

import {
  CODING_PORT_ATTEMPTS,
  CODING_PORT_START,
  CODING_WINDOW_HEIGHT,
  CODING_WINDOW_MIN_HEIGHT,
  CODING_WINDOW_MIN_WIDTH,
  CODING_WINDOW_WIDTH,
} from "../../shared/constants.ts";
import { getCodingManifest } from "./manifest.ts";

/** 仅 desktop 壳产物暴露 coding desktop export；其它 target 返回 null。 */
export function getCodingDesktopExport(): FrontendDesktopExport | null {
  if (getShellBuildTarget() !== "desktop") return null;
  return codingDesktopExport;
}

/** 有边框应用窗（bundled-spa），非 companion overlay。 */
export const codingDesktopExport: FrontendDesktopExport = {
  manifest: getCodingManifest(),
  profile: {
    embedMode: "bundled-spa",
    distSubdir: "coding",
    entryPath: "index.html",
    defaultPort: CODING_PORT_START,
    windows: [
      {
        id: "main",
        kind: "coding",
        width: CODING_WINDOW_WIDTH,
        height: CODING_WINDOW_HEIGHT,
        minWidth: CODING_WINDOW_MIN_WIDTH,
        minHeight: CODING_WINDOW_MIN_HEIGHT,
        transparent: false,
        frame: true,
        alwaysOnTop: false,
        resizable: true,
        title: "编码工作台",
      },
    ],
  },
};

export { CODING_PORT_ATTEMPTS };
