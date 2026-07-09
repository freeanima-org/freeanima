import { z } from "zod";

import { defineSettingsForm, type SettingsSection } from "../types.ts";

const debugFieldsMobile = defineSettingsForm({
  zodSchema: z.object({
    vConsoleEnabled: z.boolean(),
  }),
  items: [
    {
      key: "vConsoleEnabled",
      type: "boolean",
      label: "启用 vConsole（保存后生效）",
      group: "App 内控制台",
    },
  ],
});

export const debugSettingsSection: SettingsSection = {
  id: "debug",
  order: 90,
  category: "client",
  title: "调试",
  description: "Debug APK + USB → chrome://inspect，或启用 vConsole。",
  platforms: {
    mobile: { kind: "form", fields: debugFieldsMobile },
  },
};
