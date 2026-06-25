import type { SettingsSection } from "@freeanima/satellite-sdk/settings";

export const companionSettingsSection: SettingsSection = {
  id: "companion",
  order: 10,
  title: "桌面伴侣",
  description: "模型、行为与动作库",
  platforms: {
    desktop: {
      kind: "component",
      load: () => import("@freeanima/satellite-companion/settings-panel"),
    },
  },
};
