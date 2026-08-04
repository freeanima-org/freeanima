import type { FrontendManifest } from "@freeanima/client/portal-sdk";
import { readMonorepoVersion } from "@freeanima/client/portal-sdk/version";
import { CODING_APP_ID } from "../../shared/constants.ts";

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
