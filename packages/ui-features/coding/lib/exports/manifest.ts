import type { FrontendManifest } from "@freeanima/portal-sdk";
import { readMonorepoVersion } from "@freeanima/portal-sdk/version";
import { CODING_APP_ID } from "@freeanima/ui-features/coding/shared/constants.ts";

export const codingManifest: FrontendManifest = {
  appId: CODING_APP_ID,
  displayName: "编码工作台",
  version: readMonorepoVersion(),
  supportsDesktop: true,
  supportsMobile: false,
  remoteTools: { tools: true },
};

export function getCodingManifest(): FrontendManifest {
  return { ...codingManifest, version: readMonorepoVersion() };
}
