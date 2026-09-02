import { useEffect, useState, useSyncExternalStore } from "react";
import { Button } from "@freeanima/ui-kit";
import { ModalSheetPresent } from "@freeanima/ui-kit/composite";

import {
  getVoiceAssistantSnapshot,
  resetVoiceAssistant,
  subscribeVoiceAssistant,
} from "@freeanima/client/portal-sdk/voice-assistant/index.ts";

export type VoiceAssistantOverlayProps = {
  open: boolean;
  onClose: () => void;
};

function phaseLabel(phase: string): string {
  if (phase === "listening") return "正在聆听…";
  if (phase === "processing") return "正在理解…";
  if (phase === "speaking") return "播报中…";
  return "语音助手";
}

export function VoiceAssistantOverlay({ open, onClose }: VoiceAssistantOverlayProps) {
  const snapshot = useSyncExternalStore(
    subscribeVoiceAssistant,
    getVoiceAssistantSnapshot,
    getVoiceAssistantSnapshot,
  );

  useEffect(() => {
    if (!open) return undefined;
    if (snapshot.phase === "idle" && snapshot.resultMessage && !snapshot.error) {
      const timer = window.setTimeout(onClose, 1200);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [open, onClose, snapshot.error, snapshot.phase, snapshot.resultMessage]);

  return (
    <ModalSheetPresent
      open={open}
      onClose={() => {
        resetVoiceAssistant();
        onClose();
      }}
      aria-label="语音助手"
      showCloseButton
      className="p-6"
    >
      <div className="flex min-h-40 flex-col items-center justify-center gap-4 text-center">
        <p className="text-lg font-medium">{phaseLabel(snapshot.phase)}</p>
        {snapshot.transcript ? (
          <p className="text-muted-foreground text-sm break-words">{snapshot.transcript}</p>
        ) : null}
        {snapshot.resultMessage ? (
          <p className="text-sm text-primary">{snapshot.resultMessage}</p>
        ) : null}
        {snapshot.error ? <p className="text-sm text-destructive">{snapshot.error}</p> : null}
        <Button
          type="button"
          variant="outline"
          className="min-h-11 min-w-24"
          onPress={() => {
            resetVoiceAssistant();
            onClose();
          }}
        >
          关闭
        </Button>
      </div>
    </ModalSheetPresent>
  );
}

export function useVoiceAssistantOverlayVisible(): [boolean, (next: boolean) => void] {
  const [open, setOpen] = useState(false);
  return [open, setOpen];
}
