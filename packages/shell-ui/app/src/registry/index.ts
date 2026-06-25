import type { SettingsSection } from "../../../src/settings.ts";

import { adminSettingsSections } from "./admin-settings.ts";
import { companionSettingsSection } from "./companion-settings.ts";
import { debugSettingsSection } from "./debug-settings.ts";
import { shellSettingsSection } from "./shell-settings.ts";

/** 编译期聚合各模块设置 section */
export function getSettingsRegistry(): SettingsSection[] {
  return [
    shellSettingsSection,
    debugSettingsSection,
    companionSettingsSection,
    ...adminSettingsSections,
  ];
}
