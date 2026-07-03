declare module "@freeanima/feature-chat/ui/app" {
  import type { ComponentType } from "react";
  export const ChatApp: ComponentType;
}

declare module "@freeanima/satellite-companion/settings-panel" {
  import type { ComponentType } from "react";
  import type { SettingsPanelProps } from "@freeanima/shell-sdk/settings";
  const CompanionSettingsSection: ComponentType<SettingsPanelProps>;
  export default CompanionSettingsSection;
}

declare module "@freeanima/shell-ui/bootstrap/sentry" {
  export function sendSentryTestEvent(): Promise<void>;
  export function notifyDebugConfigChanged(): void;
}
