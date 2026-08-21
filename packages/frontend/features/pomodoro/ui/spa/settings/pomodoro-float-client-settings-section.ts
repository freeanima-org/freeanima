import type { SettingsSection } from "@freeanima/client/portal-sdk/settings";

export const pomodoroFloatClientSettingsSection: SettingsSection = {
  id: "pomodoro-float-client",
  order: 12,
  category: "client",
  title: "番茄迷你窗",
  description: "桌面置顶迷你窗显隐（贴边折叠，不随番茄会话起停）",
  platforms: {
    desktop: {
      kind: "component",
      load: () =>
        import("@freeanima/features/pomodoro/ui/spa/settings/PomodoroFloatClientSettingsSection.tsx"),
    },
  },
};
