import type { SettingsSection } from "@freeanima/shell-sdk/settings";

export const hubRuntimeSettingsSection: SettingsSection = {
  id: "hub-runtime",
  order: 50,
  category: "server",
  title: "服务配置",
  description: "保存在 Hub 数据库，影响全体客户端；修改后可能需要重启 anima service。",
  platforms: {
    desktop: {
      kind: "component",
      load: () => import("./HubRuntimeSettingsPanel.tsx"),
    },
    mobile: {
      kind: "component",
      load: () => import("./HubRuntimeSettingsPanel.tsx"),
    },
  },
};
