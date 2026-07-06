import { z } from "zod";

import { normalizeShellDebugConfig } from "../../shell-debug-config.ts";
import { defineSettingsForm, type SettingsSection } from "../types.ts";

const debugFieldsDesktop = defineSettingsForm({
  zodSchema: z
    .object({
      sentryEnabled: z.boolean(),
      sentryDsn: z.string(),
      vConsoleEnabled: z.boolean(),
    })
    .superRefine((val, ctx) => {
      try {
        normalizeShellDebugConfig(val);
      } catch (e) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: e instanceof Error ? e.message : String(e),
        });
      }
    }),
  items: [
    {
      key: "sentryEnabled",
      type: "boolean",
      label: "启用 Sentry",
      group: "Sentry 错误上报",
    },
    {
      key: "sentryDsn",
      type: "password",
      label: "Sentry DSN",
      placeholder: "https://…@o0.ingest.sentry.io/…",
      group: "Sentry 错误上报",
    },
  ],
});

const debugFieldsMobile = defineSettingsForm({
  zodSchema: debugFieldsDesktop.zodSchema,
  items: [
    ...debugFieldsDesktop.items,
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
  description:
    "桌面：F12 打开 DevTools；打包后可用 DESKTOP_SHELL_DEVTOOLS=1。移动：Debug APK + USB → chrome://inspect，或启用 vConsole。",
  platforms: {
    desktop: { kind: "form", fields: debugFieldsDesktop },
    mobile: { kind: "form", fields: debugFieldsMobile },
  },
};
