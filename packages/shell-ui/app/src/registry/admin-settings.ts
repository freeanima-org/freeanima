import type { FrontendSettingsExport } from "@freeanima/satellite-sdk";

/** Admin 管理台配置 section（P0：config / credentials 只读） */
export const adminSettingsExports: FrontendSettingsExport[] = [
  {
    appId: "admin",
    id: "runtime-config",
    order: 20,
    title: "运行时配置",
    description: "Hub 当前运行时配置（只读）",
    storage: { kind: "hub-readonly", endpoint: "/api/status/config" },
    platforms: {
      desktop: {
        kind: "component",
        load: () => import("@freeanima/admin-frontend/panels/ConfigPanel.tsx"),
      },
      mobile: {
        kind: "component",
        load: () => import("@freeanima/admin-frontend/panels/ConfigPanel.tsx"),
      },
    },
  },
  {
    appId: "admin",
    id: "credentials",
    order: 21,
    title: "凭证",
    description: "pass GPG 凭证元数据",
    storage: { kind: "hub-readonly", endpoint: "/api/credentials" },
    platforms: {
      desktop: {
        kind: "component",
        load: () => import("@freeanima/admin-frontend/panels/CredentialsPanel.tsx"),
      },
      mobile: {
        kind: "component",
        load: () => import("@freeanima/admin-frontend/panels/CredentialsPanel.tsx"),
      },
    },
  },
];
