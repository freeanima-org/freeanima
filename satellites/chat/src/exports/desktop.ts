import type { FrontendDesktopExport } from "@freeanima/shell-sdk";

import { getChatManifest } from "./manifest.ts";

export const CHAT_STATIC_PORT = 4174;
export const CHAT_STATIC_PORT_ATTEMPTS = 10;

export const chatDesktopExport: FrontendDesktopExport = {
  manifest: getChatManifest(),
  profile: {
    embedMode: "bundled-spa",
    distSubdir: "shell-ui",
    entryPath: "index.html",
    defaultPort: CHAT_STATIC_PORT,
    windows: [],
  },
};
