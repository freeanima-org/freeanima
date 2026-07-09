import { createCompanionSettingsApi } from "@freeanima/satellites/companion/spa/settings/companion-settings-api.ts";

export type DesktopSettingsApis = {
  companion: ReturnType<typeof createCompanionSettingsApi>;
};

export function createDesktopSettingsApis(): DesktopSettingsApis {
  return {
    companion: createCompanionSettingsApi(),
  };
}
