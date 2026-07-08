import { z } from "zod";

import { defineSettingsForm, type SettingsSection } from "../types.ts";

/** Hub API Token：配置了则 REST/SAP 一律附 Bearer */
const remoteAuthTokenSchema = z
  .string()
  .refine((s) => s.trim().length === 0 || s.trim().length >= 16, {
    message: "Hub API Token 至少 16 字符",
  });

export const hubFields = defineSettingsForm({
  zodSchema: z.object({
    hubUrl: z.string().min(1, "Hub 地址不能为空"),
    remoteAuthToken: remoteAuthTokenSchema,
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
      label: "Hub API Token",
      description: "anima token create 生成；REST/SAP 访问 Hub 时必填",
      group: "Hub 连接",
    },
  ],
});

const desktopGeneralFields = defineSettingsForm({
  zodSchema: z.object({
    launchAtLogin: z.boolean(),
    hubUrl: z.string().min(1, "Hub 地址不能为空"),
    remoteAuthToken: remoteAuthTokenSchema,
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
  category: "client",
  title: "连接",
  description:
    "本机保存，用于连接 Hub 的地址与 API Token。首次使用请运行 anima token create 并在下方填写 Hub API Token。",
  platforms: {
    // Web 壳层 detectPlatform() 为 desktop；字段与 mobile 相同（无开机自启动）
    desktop: { kind: "form", fields: hubFields },
    mobile: { kind: "form", fields: hubFields },
  },
};

export const desktopGeneralSettingsSection: SettingsSection = {
  id: "hub",
  order: 0,
  category: "client",
  title: "连接",
  description:
    "本机保存的桌面客户端 Hub 连接。首次使用请运行 anima token create 并在下方填写 Hub API Token。",
  platforms: {
    desktop: { kind: "form", fields: desktopGeneralFields },
  },
};
