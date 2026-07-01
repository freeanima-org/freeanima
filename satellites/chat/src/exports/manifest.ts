import type { FrontendManifest } from "@freeanima/shell-sdk";
import { readMonorepoVersion } from "@freeanima/shell-sdk/version";

const APP_ID = "chat";

export const chatManifest: FrontendManifest = {
  appId: APP_ID,
  displayName: "聊天室",
  version: readMonorepoVersion(),
  supportsDesktop: true,
  supportsMobile: true,
  sap: { relay: false },
};

export function getChatManifest(): FrontendManifest {
  return { ...chatManifest, version: readMonorepoVersion() };
}
