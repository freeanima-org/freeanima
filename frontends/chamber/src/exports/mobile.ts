import type { FrontendMobileExport } from "@freeanima/satellite-sdk";

import { getChamberManifest } from "./manifest.ts";

export const chamberMobileExport: FrontendMobileExport = {
  manifest: getChamberManifest(),
  profile: {
    connectionKind: "hub-rest",
    embedMode: "bundled-spa",
    distSubdir: "webui",
  },
};
