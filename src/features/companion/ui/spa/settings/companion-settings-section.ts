import type { SettingsSection } from "@freeanima/frontend/portal-sdk/settings";

const companionHubPanelLoad = () =>
  import("@freeanima/features/companion/ui/spa/settings/CompanionSettingsSection.tsx");

export const companionHabitatSettingsSection: SettingsSection = {
  id: "companion",
  order: 55,
  category: "server",
  title: "桌面伴侣",
  description:
    "保存在 Habitat 数据库（companion_profile），多客户端共享；修改后 sidecar 通过 sync.pull 同步到本机。",
  platforms: {
    desktop: { kind: "component", load: companionHubPanelLoad },
    mobile: { kind: "component", load: companionHubPanelLoad },
  },
};
