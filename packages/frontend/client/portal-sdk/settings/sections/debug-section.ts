import { z } from "zod";

import { defineSettingsForm, type SettingsSection } from "../types.ts";

const debugFields = defineSettingsForm({
  zodSchema: z.object({
    vConsoleEnabled: z.boolean(),
    offlineOutboxDevtoolsEnabled: z.boolean(),
  }),
  items: [
    {
      key: "vConsoleEnabled",
      type: "boolean",
      label: "启用 vConsole（保存后生效）",
      group: "App 内控制台",
    },
    {
      key: "offlineOutboxDevtoolsEnabled",
      type: "boolean",
      label: "离线 Outbox 调试面板（生产需开启；DEV 默认可用）",
      group: "离线",
    },
  ],
});

export const debugSettingsSection: SettingsSection = {
  id: "debug",
  order: 90,
  category: "client",
  title: "调试",
  description: "vConsole、离线 Outbox 只读面板等开发辅助。",
  platforms: {
    desktop: { kind: "form", fields: debugFields },
    mobile: { kind: "form", fields: debugFields },
  },
};
