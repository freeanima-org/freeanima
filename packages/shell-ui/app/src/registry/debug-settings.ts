import type { SettingsSection } from "../../../src/settings.ts";

export const debugSettingsSection: SettingsSection = {
  id: "debug",
  order: 90,
  title: "调试",
  description: "开发者工具与错误上报",
  platforms: {
    desktop: {
      kind: "component",
      load: () => import("../settings/DebugSettingsPanel.tsx"),
    },
    mobile: {
      kind: "component",
      load: () => import("../settings/DebugSettingsPanel.tsx"),
    },
  },
};
