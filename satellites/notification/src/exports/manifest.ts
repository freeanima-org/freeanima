import type { FrontendManifest } from "@freeanima/shell-sdk";
import { readMonorepoVersion } from "@freeanima/shell-sdk/version";

const APP_ID = "notification";

export const notificationManifest: FrontendManifest = {
  appId: APP_ID,
  displayName: "通知",
  version: readMonorepoVersion(),
  supportsDesktop: true,
  supportsMobile: true,
  sap: { relay: false },
};

export function getNotificationManifest(): FrontendManifest {
  return { ...notificationManifest, version: readMonorepoVersion() };
}
