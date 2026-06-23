import type { FrontendMobileExport } from "@freeanima/satellite-sdk";

import { CHAMBER_DEFAULT_PATH, getChamberManifest, resolveChamberUrl } from "./manifest.ts";

export const chamberMobileExport: FrontendMobileExport = {
  manifest: getChamberManifest(),
  profile: {
    connectionKind: "hub-rest",
    embedMode: "hub-remote",
    defaultPath: CHAMBER_DEFAULT_PATH,
    resolveUrl: (hubUrl) => resolveChamberUrl(hubUrl, CHAMBER_DEFAULT_PATH),
  },
};
