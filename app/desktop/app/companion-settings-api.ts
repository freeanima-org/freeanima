import { createCompanionSettingsApi } from "@freeanima/satellite-companion/settings-api";

export type DesktopSettingsApis = {
  companion: ReturnType<typeof createCompanionSettingsApi>;
};

export function createDesktopSettingsApis(): DesktopSettingsApis {
  return {
    companion: createCompanionSettingsApi(),
  };
}
