import type { SettingsSection } from "@freeanima/frontend/shell-sdk/settings";

export const shellModulesSettingsSection: SettingsSection = {
  id: "shell-modules",
  order: 20,
  category: "client",
  title: "模块",
  description: "控制 Shell 导航中显示的模块及顺序。设置保存在本机，不同步到 Hub。",
  platforms: {
    desktop: {
      kind: "component",
      load: () => import("./ModuleVisibilityPanel.tsx"),
    },
    mobile: {
      kind: "component",
      load: () => import("./ModuleVisibilityPanel.tsx"),
    },
  },
};
