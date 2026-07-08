import type { SettingsSection } from "@freeanima/shell-sdk/settings";

/** Hub 连接 + 局域网 HTTPS 根 CA 引导（Web / Mobile） */
export const hubConnectionSettingsSection: SettingsSection = {
  id: "hub",
  order: 0,
  category: "client",
  title: "连接",
  description:
    "本机保存，用于连接 Hub 的地址与 API Token。首次使用请运行 anima token create 并在下方填写 Hub API Token。",
  platforms: {
    desktop: {
      kind: "component",
      load: () => import("./HubConnectionSettingsPanel.tsx"),
    },
    mobile: {
      kind: "component",
      load: () => import("./HubConnectionSettingsPanel.tsx"),
    },
  },
};
