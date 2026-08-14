import { useId, useRef } from "react";
import { Button } from "@freeanima/ui-kit";

import type { ChatAttachmentDraft } from "../lib/attachments.ts";

export type ComposeAttachmentStripProps = {
  drafts: ChatAttachmentDraft[];
  disabled?: boolean;
  onAddFiles: (files: FileList | File[]) => void;
  onRemove: (localId: string) => void;
  /** 可选：自定义回形针按钮 class（Coding 皮肤） */
  className?: string;
  buttonClassName?: string;
};

export function ComposeAttachmentStrip({
  drafts,
  disabled,
  onAddFiles,
  onRemove,
  className,
  buttonClassName,
}: ComposeAttachmentStripProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className={className ?? "flex flex-col gap-1.5"}>
      {drafts.length > 0 ? (
        <ul className="flex flex-wrap gap-2" aria-label="待发送附件">
          {drafts.map((d) => (
            <li
              key={d.localId}
              className="relative flex max-w-[9rem] flex-col overflow-hidden rounded-md border border bg-muted/40"
            >
              {d.previewUrl ? (
                <img src={d.previewUrl} alt={d.filename} className="h-16 w-full object-cover" />
              ) : (
                <div className="flex h-16 items-center justify-center px-2 text-center text-[11px] text-muted-foreground">
                  {d.filename}
                </div>
              )}
              <div
                className="truncate px-1.5 py-0.5 text-[10px] text-muted-foreground"
                title={d.filename}
              >
                {d.filename}
              </div>
              <button
                type="button"
                className="absolute right-0.5 top-0.5 rounded bg-background/80 px-1 text-xs leading-none"
                aria-label={`移除 ${d.filename}`}
                disabled={disabled}
                onClick={() => onRemove(d.localId)}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="flex items-center gap-1">
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          multiple
          className="sr-only"
          disabled={disabled}
          onChange={(e) => {
            if (e.target.files?.length) onAddFiles(e.target.files);
            e.target.value = "";
          }}
        />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={buttonClassName ?? "h-7 px-2"}
          isDisabled={disabled === true}
          onClick={() => inputRef.current?.click()}
        >
          {"附件"}
        </Button>
      </div>
    </div>
  );
}
