import { z } from "zod";
import { defineSettingsForm, type FrontendSettingsExport } from "@freeanima/satellite-sdk";

const hubFields = defineSettingsForm({
  zodSchema: z.object({
    hubUrl: z.string().min(1, "Hub 地址不能为空"),
    remoteAuthToken: z.string().min(16, "远程 Token 至少 16 字符"),
  }),
  items: [
    {
      key: "hubUrl",
      type: "text",
      label: "Hub 地址",
      placeholder: "http://127.0.0.1:2658",
      description: "FreeAnima Hub REST / SAP 基址",
    },
    {
      key: "remoteAuthToken",
      type: "password",
      label: "远程 Token",
      description: "非 loopback Hub 时用于 Bearer 认证",
    },
  ],
});

export const shellSettingsExport: FrontendSettingsExport = {
  appId: "shell",
  id: "hub",
  order: 0,
  title: "Hub 连接",
  description: "配置客户端如何连接 FreeAnima Hub",
  storage: { kind: "shell-client" },
  platforms: {
    desktop: { kind: "form", fields: hubFields },
    mobile: { kind: "form", fields: hubFields },
  },
};
