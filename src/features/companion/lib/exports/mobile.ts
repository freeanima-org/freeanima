import { UnsupportedMobileError, type FrontendMobileExport } from "@freeanima/frontend/portal-sdk";

import { getCompanionManifest } from "./manifest.ts";

export const companionMobileExport: FrontendMobileExport = {
  manifest: getCompanionManifest(),
  profile: {
    embedMode: "unsupported",
  },
};

export function createCompanionMobileRuntime(): never {
  throw new UnsupportedMobileError(getCompanionManifest().appId);
}
