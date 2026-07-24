import type { SettingsSection } from "@freeanima/client/portal-sdk/settings";

const companionHubPanelLoad = () =>
  import("@freeanima/features/companion/ui/spa/settings/CompanionSettingsSection.tsx");

export const companionHabitatSettingsSection: SettingsSection = {
  id: "companion",
  order: 55,
  category: "server",
  title: "桌面伴侣",
  description:
    "保存在 Habitat 数据库（companion_profile），多客户端共享；修改后各客户端经 companion.sync.pull 同步到本机缓存。",
  platforms: {
    desktop: { kind: "component", load: companionHubPanelLoad },
    mobile: { kind: "component", load: companionHubPanelLoad },
  },
};
