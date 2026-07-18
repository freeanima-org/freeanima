import { z } from "zod";

import { defineSettingsForm, type SettingsSection } from "../types.ts";

/** 栖息地 API Token：配置了则 REST/SAP 一律附 Bearer（字段名仍为 hubUrl / remoteAuthToken） */
const remoteAuthTokenSchema = z
  .string()
  .refine((s) => s.trim().length === 0 || s.trim().length >= 16, {
    message: "栖息地 API Token 至少 16 字符",
  });

export const hubFields = defineSettingsForm({
  zodSchema: z.object({
    hubUrl: z.string().min(1, "栖息地地址不能为空"),
    remoteAuthToken: remoteAuthTokenSchema,
  }),
  items: [
    {
      key: "hubUrl",
      type: "text",
      label: "栖息地地址",
      placeholder: "http://127.0.0.1:2658",
      description: "FreeAnima 栖息地 REST / SAP 基址",
      group: "连接栖息地",
    },
    {
      key: "remoteAuthToken",
      type: "password",
      label: "栖息地 API Token",
      description: "anima token create 生成；REST/SAP 访问栖息地时必填",
      group: "连接栖息地",
    },
  ],
});

const desktopGeneralFields = defineSettingsForm({
  zodSchema: z.object({
    launchAtLogin: z.boolean(),
    hubUrl: z.string().min(1, "栖息地地址不能为空"),
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
    "本机保存，用于连接栖息地的地址与 API Token。首次使用请运行 anima token create 并在下方填写栖息地 API Token。",
  platforms: {
    // Web 壳层 detectSettingsChromePlatform() 为 desktop；字段与 mobile 相同（无开机自启动）
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
    "本机保存的桌面客户端栖息地连接（入口）。首次使用请运行 anima token create 并在下方填写栖息地 API Token。",
  platforms: {
    desktop: { kind: "form", fields: desktopGeneralFields },
  },
};
