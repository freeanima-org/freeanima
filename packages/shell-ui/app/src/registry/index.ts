import type { FrontendSettingsExport } from "@freeanima/satellite-sdk";
import { companionSettingsExport } from "@freeanima/satellite-companion/settings";

import { adminSettingsExports } from "./admin-settings.ts";
import { shellSettingsExport } from "./shell-settings.ts";

/** 编译期聚合各模块 settings 导出 */
export function getSettingsRegistry(): FrontendSettingsExport[] {
  return [shellSettingsExport, companionSettingsExport, ...adminSettingsExports];
}
