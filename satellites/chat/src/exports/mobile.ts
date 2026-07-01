import type { FrontendMobileExport } from "@freeanima/shell-sdk";

import { getChatManifest } from "./manifest.ts";

export const chatMobileExport: FrontendMobileExport = {
  manifest: getChatManifest(),
  profile: {
    embedMode: "bundled-spa",
    distSubdir: "shell-ui",
  },
};
