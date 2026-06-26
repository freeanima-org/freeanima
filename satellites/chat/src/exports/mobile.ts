import type { FrontendMobileExport } from "@freeanima/satellite-sdk";

import { getChatManifest } from "./manifest.ts";

export const chatMobileExport: FrontendMobileExport = {
  manifest: getChatManifest(),
  profile: {
    connectionKind: "sap-direct",
    embedMode: "bundled-spa",
    distSubdir: "shell-ui",
  },
};
