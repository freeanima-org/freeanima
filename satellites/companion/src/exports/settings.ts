import type { FrontendSettingsExport } from "@freeanima/satellite-sdk";

export const companionSettingsExport: FrontendSettingsExport = {
  appId: "companion",
  id: "companion",
  order: 10,
  title: "桌面伴侣",
  description: "模型、行为与动作库",
  storage: { kind: "sidecar-http", path: "/api/config" },
  platforms: {
    desktop: {
      kind: "component",
      load: () => import("../../app/src/settings/CompanionSettingsSection.tsx"),
    },
  },
};
