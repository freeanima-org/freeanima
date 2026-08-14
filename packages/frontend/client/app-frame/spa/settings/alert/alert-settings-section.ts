import type { SettingsSection } from "@freeanima/client/portal-sdk/settings";

export const alertSettingsSection: SettingsSection = {
  id: "alert",
  order: 25,
  category: "client",
  title: "提示",
  description:
    "本机瞬时提醒（系统通知与提示音）。仅作用于当前设备，不同步到 Habitat 或其他端。番茄钟、后续聊天等能力通过此通道提醒。",
  platforms: {
    desktop: {
      kind: "component",
      load: () => import("./AlertSettingsPanel.tsx"),
    },
    mobile: {
      kind: "component",
      load: () => import("./AlertSettingsPanel.tsx"),
    },
  },
};
