import type { SettingsSection } from "@freeanima/frontend/shell-sdk/settings";

export const appearanceSettingsSection: SettingsSection = {
  id: "appearance",
  order: 15,
  category: "client",
  title: "外观",
  description: "选择强调色主题，便于区分本机与远端等不同环境。设置保存在本机，不同步到 Hub。",
  platforms: {
    desktop: {
      kind: "component",
      load: () => import("./AppearancePanel.tsx"),
    },
    mobile: {
      kind: "component",
      load: () => import("./AppearancePanel.tsx"),
    },
  },
};
