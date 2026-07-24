import type { SettingsSection } from "@freeanima/client/portal-sdk/settings";

export const aboutSettingsSection: SettingsSection = {
  id: "about",
  order: 100,
  category: "client",
  title: "关于",
  description: "版本与构建信息。",
  platforms: {
    desktop: {
      kind: "component",
      load: () => import("./AboutPanel.tsx"),
    },
    mobile: {
      kind: "component",
      load: () => import("./AboutPanel.tsx"),
    },
  },
};
