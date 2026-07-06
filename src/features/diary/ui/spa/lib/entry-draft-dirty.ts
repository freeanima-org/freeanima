import type { DiaryEntryRow } from "./format-diary.ts";
import { isoToDateLocalValue } from "./format-diary.ts";

export type EntryDraft = {
  content: string;
  entryDateLocal: string;
  tagsText: string;
};

export function entryDraftFromRow(entry: DiaryEntryRow): EntryDraft {
  return {
    content: entry.content,
    entryDateLocal: isoToDateLocalValue(entry.entry_at),
    tagsText: entry.tags.join(", "),
  };
}

export function isEntryDraftDirty(draft: EntryDraft, baseline: EntryDraft): boolean {
  return (
    draft.content !== baseline.content ||
    draft.entryDateLocal !== baseline.entryDateLocal ||
    draft.tagsText !== baseline.tagsText
  );
}

export function isEntryDraftEqual(a: EntryDraft, b: EntryDraft): boolean {
  return !isEntryDraftDirty(a, b);
}

export function parseTagsText(tagsText: string): string[] {
  return tagsText
    .split(/[,，]/)
    .map((t) => t.trim())
    .filter(Boolean);
}
