import type { SpeechUnsupportedReason } from "@freeanima/client/portal-sdk/speech/adapter-types";
import { primeHabitatSpeechOutput } from "@freeanima/client/portal-sdk/speech/habitat-adapter";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@freeanima/ui-kit";
import { copyText } from "@freeanima/ui-kit/lib/copy-text.ts";
import { m } from "@freeanima/features/chat/ui/spa/lib/i18n.ts";

const COPY_FEEDBACK_MS = 3000;

type MessageActionBarProps = {
  align: "start" | "end";
  copyContent: string;
  speechText: string;
  speaking: boolean;
  speechSupported: boolean;
  speechUnavailableTitle?: string;
  speechUnsupportedReason?: SpeechUnsupportedReason | null;
  onToggleSpeech: () => void;
  onEdit?: () => void;
};

export function MessageActionBar({
  align,
  copyContent,
  speechText,
  speaking,
  speechSupported,
  speechUnavailableTitle,
  speechUnsupportedReason,
  onToggleSpeech,
  onEdit,
}: MessageActionBarProps) {
  const [copied, setCopied] = useState(false);
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const canSpeak = speechSupported && speechText.trim().length > 0;

  useEffect(() => {
    return () => {
      if (copiedTimerRef.current != null) clearTimeout(copiedTimerRef.current);
    };
  }, []);

  const handleCopy = useCallback(async () => {
    const ok = await copyText(copyContent);
    if (!ok) return;
    setCopied(true);
    if (copiedTimerRef.current != null) clearTimeout(copiedTimerRef.current);
    copiedTimerRef.current = setTimeout(() => setCopied(false), COPY_FEEDBACK_MS);
  }, [copyContent]);

  return (
    <div
      className={`message-action-bar mt-1 flex items-center gap-0.5 ${
        align === "end" ? "justify-end" : "justify-start"
      }`}
    >
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className={`size-7 text-xs ${copied ? "text-foreground" : "text-muted-foreground"}`}
        aria-label={
          copied ? m.habitat_common_copied({ label: "" }).trim() : m.habitat_common_copy()
        }
        onClick={() => void handleCopy()}
      >
        {copied ? "✓" : "⎘"}
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="text-muted-foreground size-7 text-xs"
        isDisabled={!canSpeak}
        aria-label={speaking ? m.chat_speech_stop() : m.chat_speech_play()}
        title={
          !speechSupported
            ? (speechUnavailableTitle ??
              (speechUnsupportedReason === "insecure_context"
                ? m.chat_speech_insecure_context()
                : m.chat_speech_unavailable()))
            : undefined
        }
        onPointerDown={() => {
          if (canSpeak) primeHabitatSpeechOutput();
        }}
        onClick={onToggleSpeech}
      >
        {speaking ? "■" : "▶"}
      </Button>
      {onEdit ? (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="text-muted-foreground size-7 text-xs"
          aria-label={m.habitat_common_edit()}
          onClick={onEdit}
        >
          ✎
        </Button>
      ) : null}
    </div>
  );
}
