import type { FrontendDesktopExport } from "@freeanima/satellite-sdk";

import { CHAMBER_DEFAULT_PATH, getChamberManifest } from "./manifest.ts";

export const CHAMBER_STATIC_PORT = 4175;
export const CHAMBER_STATIC_PORT_ATTEMPTS = 10;

export const chamberDesktopExport: FrontendDesktopExport = {
  manifest: getChamberManifest(),
  profile: {
    connectionKind: "hub-rest",
    embedMode: "bundled-spa",
    distSubdir: "chamber",
    entryPath: "index.html",
    defaultPath: CHAMBER_DEFAULT_PATH,
    defaultPort: CHAMBER_STATIC_PORT,
    windows: [
      {
        id: "main",
        kind: "browser",
        width: 1100,
        height: 800,
        minWidth: 720,
        minHeight: 560,
        title: "FreeAnima 卧室",
        frame: true,
        resizable: true,
      },
    ],
  },
};
