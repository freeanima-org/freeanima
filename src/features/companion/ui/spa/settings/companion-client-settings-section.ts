import type { SettingsSection } from "@freeanima/frontend/portal-sdk/settings";

export const companionClientSettingsSection: SettingsSection = {
  id: "companion-client",
  order: 11,
  category: "client",
  title: "桌面伴侣",
  description: "本机窗口显隐与远程工具连接状态（只读）",
  platforms: {
    desktop: {
      kind: "component",
      load: () =>
        import("@freeanima/features/companion/ui/spa/settings/CompanionClientSettingsSection.tsx"),
    },
  },
};
