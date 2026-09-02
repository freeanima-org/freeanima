import type { SettingsSection } from "@freeanima/client/portal-sdk/settings";

export const voiceAssistantSettingsSection: SettingsSection = {
  id: "voice_assistant",
  order: 26,
  category: "client",
  title: "语音助手",
  description:
    "Android 移动壳唤醒词与语音指令。后台监听需麦克风与前台服务通知；复杂语义可走 LLM 理解（需网络）。",
  platforms: {
    mobile: {
      kind: "component",
      load: () => import("./VoiceAssistantSettingsPanel.tsx"),
    },
  },
};
