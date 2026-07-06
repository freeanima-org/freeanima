import { Button } from "@freeanima/ui-kit";
import { m } from "@chat/lib/i18n.ts";

type MessageActionBarProps = {
  align: "start" | "end";
  speechText: string;
  speaking: boolean;
  speechSupported: boolean;
  onCopy: () => void;
  onToggleSpeech: () => void;
  onEdit?: () => void;
};

export function MessageActionBar({
  align,
  speechText,
  speaking,
  speechSupported,
  onCopy,
  onToggleSpeech,
  onEdit,
}: MessageActionBarProps) {
  const canSpeak = speechSupported && speechText.trim().length > 0;

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
        className="text-muted-foreground size-7 text-xs"
        aria-label={m.console_common_copy()}
        onClick={onCopy}
      >
        ⎘
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="text-muted-foreground size-7 text-xs"
        disabled={!canSpeak}
        aria-label={speaking ? m.chat_speech_stop() : m.chat_speech_play()}
        title={!speechSupported ? m.chat_speech_unavailable() : undefined}
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
          aria-label={m.console_common_edit()}
          onClick={onEdit}
        >
          ✎
        </Button>
      ) : null}
    </div>
  );
}
