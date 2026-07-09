import type { SettingsSection } from "@freeanima/frontend/shell-sdk/settings";

export const companionHubSettingsSection: SettingsSection = {
  id: "companion",
  order: 55,
  category: "server",
  title: "桌面伴侣",
  description:
    "保存在 Hub 数据库（companion_profile），多客户端共享；修改后 sidecar 通过 sync.pull 同步到本机。",
  platforms: {
    desktop: {
      kind: "component",
      load: () =>
        import("@freeanima/satellites/companion/spa/settings/CompanionSettingsSection.tsx"),
    },
  },
};

/** @deprecated 使用 companionHubSettingsSection */
export const companionSettingsSection = companionHubSettingsSection;
