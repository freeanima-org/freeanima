import { useEffect, useState } from "react";
import { Button, Input, Label, Textarea } from "@freeanima/ui-kit";

import type { DiaryEntryRow } from "../lib/format-diary.ts";
import {
  dateLocalToEntryAtIso,
  defaultEntryDateLocal,
  isoToDateLocalValue,
  titleFromDateLocal,
} from "../lib/format-diary.ts";

export type EntryEditorMode = "create" | "edit";

export function EntryEditor({
  mode,
  entry,
  saving,
  readOnly = false,
  onSave,
  onDelete,
  onCancel,
}: {
  mode: EntryEditorMode;
  entry: DiaryEntryRow | null;
  saving: boolean;
  readOnly?: boolean;
  onSave: (draft: {
    title: string;
    summary: string;
    content: string;
    entry_at: string;
    tags: string[];
  }) => void;
  onDelete?: () => void;
  onCancel?: () => void;
}) {
  const [content, setContent] = useState("");
  const [entryDateLocal, setEntryDateLocal] = useState(defaultEntryDateLocal());
  const [tagsText, setTagsText] = useState("");

  useEffect(() => {
    if (mode === "edit" && entry) {
      setContent(entry.content);
      setEntryDateLocal(isoToDateLocalValue(entry.entry_at));
      setTagsText(entry.tags.join(", "));
    } else if (mode === "create") {
      setContent("");
      setEntryDateLocal(defaultEntryDateLocal());
      setTagsText("");
    }
  }, [mode, entry]);

  const tags = tagsText
    .split(/[,，]/)
    .map((t) => t.trim())
    .filter(Boolean);

  return (
    <form
      className="flex h-full min-h-0 flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (readOnly) return;
        onSave({
          title: titleFromDateLocal(entryDateLocal),
          summary: "",
          content,
          entry_at: dateLocalToEntryAtIso(entryDateLocal),
          tags,
        });
      }}
    >
      <div className="flex w-full shrink-0 flex-col gap-1.5">
        <Label className="text-xs">日期</Label>
        <Input
          type="date"
          className="h-8 w-full"
          value={entryDateLocal}
          onChange={(e) => setEntryDateLocal(e.target.value)}
          required
          disabled={readOnly}
        />
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-1.5">
        <Label className="shrink-0 text-xs">正文</Label>
        <Textarea
          className="min-h-0 w-full flex-1 resize-none font-mono text-sm leading-relaxed"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="写点什么…"
          readOnly={readOnly}
        />
      </div>

      <div className="flex w-full shrink-0 flex-col gap-1.5">
        <Label className="text-xs">标签（逗号分隔，可选）</Label>
        <Input
          className="h-8 w-full"
          value={tagsText}
          onChange={(e) => setTagsText(e.target.value)}
          readOnly={readOnly}
        />
      </div>

      <div className="flex shrink-0 flex-wrap gap-2 pt-1">
        {!readOnly ? (
          <>
            <Button type="submit" size="sm" disabled={saving}>
              {mode === "create" ? "新建" : "保存"}
            </Button>
            {mode === "edit" && onDelete ? (
              <Button
                type="button"
                variant="destructive"
                size="sm"
                disabled={saving}
                onClick={onDelete}
              >
                删除
              </Button>
            ) : null}
          </>
        ) : null}
        {onCancel ? (
          <Button type="button" variant="ghost" size="sm" disabled={saving} onClick={onCancel}>
            取消
          </Button>
        ) : null}
      </div>
    </form>
  );
}
