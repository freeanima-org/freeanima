import { Label, Switch } from "@freeanima/frontend/ui-kit";
import {
  useChatLlmDebugEnabled,
  useSetChatLlmDebugEnabled,
} from "@freeanima/frontend/shell-sdk/react.tsx";
import type { SettingsPanelProps } from "@freeanima/frontend/shell-sdk/settings";
import { m } from "@paraglide/messages";

export default function ChatSettingsPanel(_props: SettingsPanelProps) {
  const llmDebugEnabled = useChatLlmDebugEnabled();
  const setLlmDebugEnabled = useSetChatLlmDebugEnabled();

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4 rounded-lg border px-4 py-3">
        <div className="min-w-0 space-y-1">
          <Label htmlFor="chat-llm-debug" className="text-sm font-medium">
            {m.settings_chat_llm_debug_label()}
          </Label>
          <p className="text-xs text-muted-foreground">{m.settings_chat_llm_debug_hint()}</p>
        </div>
        <Switch
          id="chat-llm-debug"
          checked={llmDebugEnabled}
          onCheckedChange={(checked) => setLlmDebugEnabled(checked === true)}
          aria-label={m.settings_chat_llm_debug_label()}
        />
      </div>
    </div>
  );
}
