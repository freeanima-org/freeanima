import { useState } from "react";
import { Button, Input, Label, Switch } from "@freeanima/ui-kit";
import { toast } from "@freeanima/ui-kit/composite";
import type { SettingsPanelProps } from "@freeanima/client/portal-sdk/settings";

import {
  readVoiceAssistantPrefs,
  writeVoiceAssistantPrefs,
} from "@freeanima/client/portal-sdk/voice-assistant/prefs.ts";
import { isVoiceWakeSupported } from "@freeanima/client/portal-sdk/voice-wake/index.ts";
import { getShellBuildTarget } from "@freeanima/client/portal-sdk/shell-runtime.ts";
import { runVoiceAssistantTurn } from "@freeanima/client/portal-sdk/voice-assistant/index.ts";
import {
  ensureVoiceAssistantPermissions,
  notifyVoiceAssistantPrefsChanged,
} from "@freeanima/client/portal-sdk/voice-assistant/mobile-setup.ts";

export default function VoiceAssistantSettingsPanel(_props: SettingsPanelProps) {
  const supported = getShellBuildTarget() === "mobile" && isVoiceWakeSupported();
  const [prefs, setPrefs] = useState(() => readVoiceAssistantPrefs());
  const [busy, setBusy] = useState(false);

  if (!supported) {
    return <p className="text-muted-foreground text-sm">语音助手唤醒仅适用于 Android 移动壳。</p>;
  }

  const save = (patch: Partial<typeof prefs>) => {
    const next = writeVoiceAssistantPrefs(patch);
    setPrefs(next);
    notifyVoiceAssistantPrefsChanged();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 min-h-11">
        <div>
          <Label htmlFor="voice-wake-enabled">启用唤醒词</Label>
          <p className="text-muted-foreground text-xs mt-1">
            后台监听「{prefs.wakePhrase}」；会显示前台通知并增加耗电。
          </p>
        </div>
        <Switch
          id="voice-wake-enabled"
          isSelected={prefs.wakeEnabled}
          onChange={(selected) => {
            void (async () => {
              if (selected) {
                const ok = await ensureVoiceAssistantPermissions();
                if (!ok) {
                  toast("需要麦克风权限才能启用唤醒", { duration: 4000 });
                  return;
                }
              }
              save({ wakeEnabled: selected });
            })();
          }}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="voice-wake-phrase">唤醒词</Label>
        <Input
          id="voice-wake-phrase"
          value={prefs.wakePhrase}
          onChange={(e) => save({ wakePhrase: e.target.value })}
          className="min-h-11"
        />
      </div>

      <div className="flex items-center justify-between gap-3 min-h-11">
        <div>
          <Label htmlFor="voice-prefer-cloud">云端 ASR 增强</Label>
          <p className="text-muted-foreground text-xs mt-1">
            优先使用栖息地 fun-asr 识别（需配置 audio_generate.asr）。
          </p>
        </div>
        <Switch
          id="voice-prefer-cloud"
          isSelected={prefs.preferCloudAsr}
          onChange={(selected) => save({ preferCloudAsr: selected })}
        />
      </div>

      <div className="flex items-center justify-between gap-3 min-h-11">
        <div>
          <Label htmlFor="voice-wifi-llm">仅 Wi‑Fi 下 LLM 理解</Label>
          <p className="text-muted-foreground text-xs mt-1">
            复杂指令走单回合 LLM；开启后蜂窝网络仅使用本地快路径。
          </p>
        </div>
        <Switch
          id="voice-wifi-llm"
          isSelected={prefs.llmFallbackWifiOnly}
          onChange={(selected) => save({ llmFallbackWifiOnly: selected })}
        />
      </div>

      <Button
        type="button"
        className="min-h-11"
        isDisabled={busy}
        onPress={() => {
          setBusy(true);
          void runVoiceAssistantTurn({ preferCloud: prefs.preferCloudAsr }).finally(() =>
            setBusy(false),
          );
        }}
      >
        {busy ? "测试中…" : "试一次（指令识别流程）"}
      </Button>
    </div>
  );
}
