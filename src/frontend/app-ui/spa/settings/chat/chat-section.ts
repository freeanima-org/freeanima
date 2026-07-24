import type { SettingsSection } from "@freeanima/frontend/portal-sdk/settings";

export const chatSettingsSection: SettingsSection = {
  id: "chat",
  order: 18,
  category: "client",
  title: "聊天",
  description: "本机聊天相关偏好。设置保存在本机，不同步到 Habitat。",
  platforms: {
    desktop: {
      kind: "component",
      load: () => import("./ChatSettingsPanel.tsx"),
    },
    mobile: {
      kind: "component",
      load: () => import("./ChatSettingsPanel.tsx"),
    },
  },
};
