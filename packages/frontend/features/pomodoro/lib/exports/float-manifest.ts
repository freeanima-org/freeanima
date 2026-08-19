import type { FrontendManifest } from "@freeanima/client/portal-sdk";
import { readMonorepoVersion } from "@freeanima/client/portal-sdk/version";

export const pomodoroFloatManifest: FrontendManifest = {
  appId: "pomodoro-float",
  displayName: "番茄迷你窗",
  version: readMonorepoVersion(),
  supportsDesktop: true,
  supportsMobile: false,
};

export function getPomodoroFloatManifest(): FrontendManifest {
  return { ...pomodoroFloatManifest, version: readMonorepoVersion() };
}
