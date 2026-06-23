import type { FrontendDesktopExport } from "@freeanima/satellite-sdk";

import { getChatManifest } from "./manifest.ts";

export const CHAT_STATIC_PORT = 4174;
export const CHAT_STATIC_PORT_ATTEMPTS = 10;

export const chatDesktopExport: FrontendDesktopExport = {
  manifest: getChatManifest(),
  profile: {
    connectionKind: "sap-direct",
    embedMode: "bundled-spa",
    distSubdir: "chat",
    entryPath: "index.html",
    defaultPort: CHAT_STATIC_PORT,
    windows: [
      {
        id: "main",
        kind: "browser",
        width: 960,
        height: 720,
        minWidth: 640,
        minHeight: 480,
        title: "FreeAnima 会客厅",
        frame: true,
        resizable: true,
      },
    ],
  },
};
