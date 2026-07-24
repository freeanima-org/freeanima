import type { SettingsSection } from "@freeanima/client/portal-sdk/settings";

/** Habitat 连接 + 局域网 HTTPS 根 CA 引导（Web / Mobile） */
export const habitatConnectionSettingsSection: SettingsSection = {
  id: "habitat",
  order: 0,
  category: "client",
  title: "连接",
  description:
    "本机保存，用于连接栖息地的地址与 API Token。首次使用请运行 anima token create 并在下方填写栖息地 API Token。",
  platforms: {
    desktop: {
      kind: "component",
      load: () => import("./HabitatConnectionSettingsPanel.tsx"),
    },
    mobile: {
      kind: "component",
      load: () => import("./HabitatConnectionSettingsPanel.tsx"),
    },
  },
};
