import { Label, Switch } from "@freeanima/ui-kit";
import {
  useChatLlmDebugEnabled,
  useSetChatLlmDebugEnabled,
} from "@freeanima/client/portal-sdk/react.tsx";
import type { SettingsPanelProps } from "@freeanima/client/portal-sdk/settings";

export default function ChatSettingsPanel(_props: SettingsPanelProps) {
  const llmDebugEnabled = useChatLlmDebugEnabled();
  const setLlmDebugEnabled = useSetChatLlmDebugEnabled();

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4 rounded-lg border px-4 py-3">
        <div className="min-w-0 space-y-1">
          <Label htmlFor="chat-llm-debug" className="text-sm font-medium">
            {"Enable LLM debug"}
          </Label>
          <p className="text-xs text-muted-foreground">
            {
              "When on, each send captures invoke snapshots on the Habitat (Redis, 10 min TTL). Open Debug in Chat to fetch — not streamed over Habitat RPC."
            }
          </p>
        </div>
        <Switch
          id="chat-llm-debug"
          isSelected={llmDebugEnabled}
          onChange={(checked) => setLlmDebugEnabled(checked === true)}
          aria-label={"Enable LLM debug"}
        />
      </div>
    </div>
  );
}
