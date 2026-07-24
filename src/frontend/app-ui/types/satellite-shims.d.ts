declare module "@freeanima/features/chat/ui/spa" {
  import type { ComponentType } from "react";
  export const ChatApp: ComponentType;
}

declare module "@freeanima/satellites/companion/spa/settings/CompanionSettingsSection.tsx" {
  import type { ComponentType } from "react";
  import type { SettingsPanelProps } from "@freeanima/frontend/portal-sdk/settings";
  const CompanionSettingsSection: ComponentType<SettingsPanelProps>;
  export default CompanionSettingsSection;
}

declare module "@freeanima/satellites/companion/spa/settings/CompanionClientSettingsSection.tsx" {
  import type { ComponentType } from "react";
  import type { SettingsPanelProps } from "@freeanima/frontend/portal-sdk/settings";
  const CompanionClientSettingsSection: ComponentType<SettingsPanelProps>;
  export default CompanionClientSettingsSection;
}
