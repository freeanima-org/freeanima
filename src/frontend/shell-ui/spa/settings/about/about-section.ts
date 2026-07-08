import type { SettingsSection } from "@freeanima/shell-sdk/settings";

export const aboutSettingsSection: SettingsSection = {
  id: "about",
  order: 100,
  category: "client",
  title: "关于",
  description: "Hub 服务、Web UI 与原生壳层的版本与构建信息。",
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
