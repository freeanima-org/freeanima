import type { FrontendManifest } from "@freeanima/satellite-sdk";
import { readMonorepoVersion } from "@freeanima/satellite-sdk";
import { COMPANION_APP_ID } from "../../shared/constants.ts";

export const companionManifest: FrontendManifest = {
  appId: COMPANION_APP_ID,
  displayName: "桌面伴侣",
  version: readMonorepoVersion(),
  supportsDesktop: true,
  supportsMobile: false,
  connectionKind: "embedded-sidecar",
  sap: { relay: false, tools: true },
};

export function getCompanionManifest(): FrontendManifest {
  return { ...companionManifest, version: readMonorepoVersion() };
}
