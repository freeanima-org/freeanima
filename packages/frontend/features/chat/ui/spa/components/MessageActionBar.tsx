import type { SpeechUnsupportedReason } from "@freeanima/client/portal-sdk/speech/adapter-types";
import { primeHabitatSpeechOutput } from "@freeanima/client/portal-sdk/speech/habitat-adapter";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@freeanima/ui-kit";
import { copyText } from "@freeanima/ui-kit/lib/copy-text.ts";

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
        aria-label={copied ? "已复制" : "复制"}
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
        aria-label={speaking ? "停止朗读" : "朗读"}
        title={
          !speechSupported
            ? (speechUnavailableTitle ??
              (speechUnsupportedReason === "insecure_context"
                ? "Web Speech 需要 HTTPS；请使用 Edge TTS，或通过 HTTPS 打开服务"
                : "此设备不支持语音朗读"))
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
          aria-label={"编辑"}
          onClick={onEdit}
        >
          ✎
        </Button>
      ) : null}
    </div>
  );
}
