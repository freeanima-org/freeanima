import type { FrontendManifest } from "@freeanima/client/portal-sdk";
import { readMonorepoVersion } from "@freeanima/client/portal-sdk/version";
import { COMPANION_APP_ID } from "@freeanima/shared/companion-app/constants.ts";

export const companionManifest: FrontendManifest = {
  appId: COMPANION_APP_ID,
  displayName: "桌面伴侣",
  version: readMonorepoVersion(),
  supportsDesktop: true,
  supportsMobile: false,
  remoteTools: { tools: true },
};

export function getCompanionManifest(): FrontendManifest {
  return { ...companionManifest, version: readMonorepoVersion() };
}
