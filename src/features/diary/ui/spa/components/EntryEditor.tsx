import { CalendarIcon } from "lucide-react";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger,
  Input,
  Textarea,
} from "@freeanima/frontend/ui-kit";

import type { EntryDraft } from "../lib/entry-draft-dirty.ts";

export type EntrySaveStatus = "idle" | "saving" | "saved" | "error";

function saveStatusLabel(status: EntrySaveStatus): string {
  switch (status) {
    case "saving":
      return "保存中…";
    case "saved":
      return "已保存";
    case "error":
      return "保存失败";
    default:
      return "";
  }
}

function formatEntryDateChip(dateLocal: string): string {
  if (!dateLocal) return "日期";
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateLocal);
  if (!match) return dateLocal;
  const month = Number(match[2]);
  const day = Number(match[3]);
  return `${month}月${day}日`;
}

export function EntryEditor({
  draft,
  onDraftChange,
  saveStatus = "idle",
  readOnly = false,
  onDelete,
  onCancel,
}: {
  draft: EntryDraft;
  onDraftChange: (draft: EntryDraft) => void;
  saveStatus?: EntrySaveStatus;
  readOnly?: boolean;
  onDelete?: () => void;
  onCancel?: () => void;
}) {
  const statusLabel = saveStatusLabel(saveStatus);

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="flex shrink-0 items-center gap-1">
        {readOnly ? (
          <span className="text-muted-foreground inline-flex h-8 items-center gap-1.5 px-2 text-sm">
            <CalendarIcon className="size-4 shrink-0" />
            {formatEntryDateChip(draft.entryDateLocal)}
          </span>
        ) : (
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-muted-foreground h-8 gap-1.5 px-2 font-normal"
                aria-label="日期"
              >
                <CalendarIcon className="size-4 shrink-0" />
                <span>{formatEntryDateChip(draft.entryDateLocal)}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              className="w-56 p-3"
              onCloseAutoFocus={(e) => e.preventDefault()}
            >
              <DropdownMenuLabel className="px-0 pt-0">日期</DropdownMenuLabel>
              <div onPointerDown={(e) => e.stopPropagation()}>
                <Input
                  type="date"
                  className="h-8 w-full"
                  value={draft.entryDateLocal}
                  onChange={(e) => onDraftChange({ ...draft, entryDateLocal: e.target.value })}
                  required
                />
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      <Textarea
        className="min-h-0 w-full flex-1 resize-none border-0 bg-transparent px-0 font-mono text-sm leading-relaxed shadow-none focus-visible:ring-0"
        value={draft.content}
        onChange={(e) => onDraftChange({ ...draft, content: e.target.value })}
        placeholder="写点什么…"
        aria-label="正文"
        readOnly={readOnly}
      />

      <div className="flex shrink-0 flex-wrap items-center gap-2 pt-1">
        {!readOnly && onDelete ? (
          <Button type="button" variant="destructive" size="sm" onClick={onDelete}>
            删除
          </Button>
        ) : null}
        {onCancel ? (
          <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
            取消
          </Button>
        ) : null}
        {statusLabel ? (
          <span className="text-muted-foreground ml-auto text-xs">{statusLabel}</span>
        ) : null}
      </div>
    </div>
  );
}
