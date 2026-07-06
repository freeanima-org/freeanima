import { Button, Input, Label, Textarea } from "@freeanima/ui-kit";

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
      <div className="flex w-full shrink-0 flex-col gap-1.5">
        <Label className="text-xs">日期</Label>
        <Input
          type="date"
          className="h-8 w-full"
          value={draft.entryDateLocal}
          onChange={(e) => onDraftChange({ ...draft, entryDateLocal: e.target.value })}
          required
          disabled={readOnly}
        />
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-1.5">
        <Label className="shrink-0 text-xs">正文</Label>
        <Textarea
          className="min-h-0 w-full flex-1 resize-none font-mono text-sm leading-relaxed"
          value={draft.content}
          onChange={(e) => onDraftChange({ ...draft, content: e.target.value })}
          placeholder="写点什么…"
          readOnly={readOnly}
        />
      </div>

      <div className="flex w-full shrink-0 flex-col gap-1.5">
        <Label className="text-xs">标签（逗号分隔，可选）</Label>
        <Input
          className="h-8 w-full"
          value={draft.tagsText}
          onChange={(e) => onDraftChange({ ...draft, tagsText: e.target.value })}
          readOnly={readOnly}
        />
      </div>

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
