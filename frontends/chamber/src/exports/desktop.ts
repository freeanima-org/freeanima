import type { FrontendDesktopExport } from "@freeanima/satellite-sdk";

import { CHAMBER_DEFAULT_PATH, getChamberManifest, resolveChamberUrl } from "./manifest.ts";

export { resolveChamberUrl, CHAMBER_DEFAULT_PATH };

export const chamberDesktopExport: FrontendDesktopExport = {
  manifest: getChamberManifest(),
  profile: {
    connectionKind: "hub-rest",
    embedMode: "hub-remote",
    defaultPath: CHAMBER_DEFAULT_PATH,
    resolveUrl: (hubUrl) => resolveChamberUrl(hubUrl, CHAMBER_DEFAULT_PATH),
  },
};
