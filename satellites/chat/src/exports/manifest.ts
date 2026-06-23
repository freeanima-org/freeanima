import type { FrontendManifest } from "@freeanima/satellite-sdk";
import { readMonorepoVersion } from "@freeanima/satellite-sdk";

const APP_ID = "chat";

export const chatManifest: FrontendManifest = {
  appId: APP_ID,
  displayName: "会客厅",
  version: readMonorepoVersion(),
  supportsDesktop: true,
  supportsMobile: true,
  connectionKind: "sap-direct",
  sap: { relay: false },
};

export function getChatManifest(): FrontendManifest {
  return { ...chatManifest, version: readMonorepoVersion() };
}
