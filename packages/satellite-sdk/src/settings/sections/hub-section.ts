import { z } from "zod";

import { defineSettingsForm, type SettingsSection } from "../types.ts";

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
      group: "Hub 连接",
    },
    {
      key: "remoteAuthToken",
      type: "password",
      label: "远程 Token",
      description: "非 loopback Hub 时用于 Bearer 认证",
      group: "Hub 连接",
    },
  ],
});

const desktopGeneralFields = defineSettingsForm({
  zodSchema: z.object({
    launchAtLogin: z.boolean(),
    hubUrl: z.string().min(1, "Hub 地址不能为空"),
    remoteAuthToken: z.string().min(16, "远程 Token 至少 16 字符"),
  }),
  items: [
    {
      key: "launchAtLogin",
      type: "boolean",
      label: "开机自启动",
      description: "系统登录后自动启动 FreeAnima Desktop（默认关闭）",
      group: "启动",
    },
    ...hubFields.items,
  ],
});

export const hubSettingsSection: SettingsSection = {
  id: "hub",
  order: 0,
  title: "通用",
  description:
    "客户端通用设置与 Hub 连接。远程访问需配置 remote_auth.token（见 docs/guide/remote-access.md）。",
  platforms: {
    mobile: { kind: "form", fields: hubFields },
  },
};

export const desktopGeneralSettingsSection: SettingsSection = {
  id: "hub",
  order: 0,
  title: "通用",
  description:
    "桌面客户端通用设置与 Hub 连接。PC 上运行 anima service；远程访问需配置 remote_auth.token（见 docs/guide/remote-access.md）。",
  platforms: {
    desktop: { kind: "form", fields: desktopGeneralFields },
  },
};
