import type { SettingsSection } from "@freeanima/client/portal-sdk/settings";

export const shellModulesSettingsSection: SettingsSection = {
  id: "shell-modules",
  order: 20,
  category: "client",
  title: "模块",
  description:
    "控制 Shell 导航中显示的模块及顺序。窄屏可设底栏常用模块个数，多出的收进「更多」。设置保存在本机，不同步到栖息地。",
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
