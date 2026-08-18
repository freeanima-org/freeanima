import type { SettingsSection } from "@freeanima/client/portal-sdk/settings";

const companionHubPanelLoad = () =>
  import("@freeanima/features/companion/ui/spa/settings/CompanionSettingsSection.tsx");

export const companionHabitatSettingsSection: SettingsSection = {
  id: "companion",
  /** 接在文本嵌入（57）之后、运维侧栏（60+）之前，避免插进能力层中间 */
  order: 58,
  category: "server",
  title: "桌面伴侣",
  description:
    "保存在 Habitat runtime 段 companion（模块配置，多客户端共享）；二进制走对象存储（object_file_id）；修改后各客户端经 companion.sync.pull 同步到本机缓存。",
  platforms: {
    desktop: { kind: "component", load: companionHubPanelLoad },
    mobile: { kind: "component", load: companionHubPanelLoad },
  },
};
