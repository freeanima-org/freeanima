import type { FrontendMobileExport } from "@freeanima/satellite-sdk";

import { buildChatApp } from "../../build.ts";
import { getChatManifest } from "./manifest.ts";

export { buildChatApp };

export const chatMobileExport: FrontendMobileExport = {
  manifest: getChatManifest(),
  profile: {
    connectionKind: "sap-direct",
    embedMode: "bundled-spa",
    distSubdir: "chat",
  },
};
