import { useEffect, useState } from "react";

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
  onSave,
  onDelete,
  onCancel,
}: {
  mode: EntryEditorMode;
  entry: DiaryEntryRow | null;
  saving: boolean;
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
        onSave({
          title: titleFromDateLocal(entryDateLocal),
          summary: "",
          content,
          entry_at: dateLocalToEntryAtIso(entryDateLocal),
          tags,
        });
      }}
    >
      <label className="form-control w-full shrink-0">
        <span className="label-text text-xs">日期</span>
        <input
          type="date"
          className="input input-bordered input-sm w-full"
          value={entryDateLocal}
          onChange={(e) => setEntryDateLocal(e.target.value)}
          required
        />
      </label>

      <label className="form-control flex min-h-0 flex-1 flex-col">
        <span className="label-text text-xs shrink-0">正文</span>
        <textarea
          className="textarea textarea-bordered min-h-0 w-full flex-1 resize-none font-mono text-sm leading-relaxed"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="写点什么…"
        />
      </label>

      <label className="form-control w-full shrink-0">
        <span className="label-text text-xs">标签（逗号分隔，可选）</span>
        <input
          className="input input-bordered input-sm w-full"
          value={tagsText}
          onChange={(e) => setTagsText(e.target.value)}
        />
      </label>

      <div className="flex shrink-0 flex-wrap gap-2 pt-1">
        <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
          {mode === "create" ? "新建" : "保存"}
        </button>
        {mode === "edit" && onDelete ? (
          <button
            type="button"
            className="btn btn-error btn-sm btn-outline"
            disabled={saving}
            onClick={onDelete}
          >
            删除
          </button>
        ) : null}
        {onCancel ? (
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            disabled={saving}
            onClick={onCancel}
          >
            取消
          </button>
        ) : null}
      </div>
    </form>
  );
}
