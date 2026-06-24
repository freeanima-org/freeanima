declare module "@freeanima/satellite-chat/app" {
  import type { ComponentType } from "react";
  export type ChatAppComponent = ComponentType;
  export function loadChatApp(): Promise<{ default: ChatAppComponent }>;
}

declare module "@freeanima/satellite-companion/settings" {
  import type { FrontendSettingsExport } from "@freeanima/satellite-sdk";
  export const companionSettingsExport: FrontendSettingsExport;
}

declare module "@freeanima/satellite-companion/settings-panel" {
  import type { ComponentType } from "react";
  import type { SettingsPanelProps } from "@freeanima/satellite-sdk";
  const CompanionSettingsSection: ComponentType<SettingsPanelProps>;
  export default CompanionSettingsSection;
}

declare module "@freeanima/admin-frontend/panels/ConfigPanel.tsx" {
  import type { ComponentType } from "react";
  import type { SettingsPanelProps } from "@freeanima/satellite-sdk";
  const ConfigPanel: ComponentType<SettingsPanelProps>;
  export default ConfigPanel;
}

declare module "@freeanima/admin-frontend/panels/CredentialsPanel.tsx" {
  import type { ComponentType } from "react";
  import type { SettingsPanelProps } from "@freeanima/satellite-sdk";
  const CredentialsPanel: ComponentType<SettingsPanelProps>;
  export default CredentialsPanel;
}

declare module "@freeanima/admin-frontend/router" {
  import type { AnyRouter } from "@tanstack/react-router";
  export function getRouter(opts?: { basepath?: string }): AnyRouter;
}

declare module "@freeanima/admin-frontend/i18n" {
  export function initAdminLocale(): string;
}

declare module "@freeanima/admin-frontend/paraglide-compile" {
  export function compileParaglideToDir(opts: {
    projectRoot: string;
    outdir: string;
    clean?: boolean;
  }): string;
}
