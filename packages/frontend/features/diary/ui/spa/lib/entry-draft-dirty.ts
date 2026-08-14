import type { DiaryEntryRow, DiaryTextBlock } from "./format-diary.ts";
import { isoToDateLocalValue } from "./format-diary.ts";

export type BlockDraft = {
  id: number;
  title: string;
  content: string;
  sort_order: number;
  client_op_id: string | null;
  components: string[];
  tag_ids: number[];
};

export type EntryDraft = {
  blocks: BlockDraft[];
  entryDateLocal: string;
  tag_ids: number[];
};

/** React / DnD 稳定键：保存后 id 可变，client_op_id 不变时可避免输入控件 remount */
export function blockUiKey(block: Pick<BlockDraft, "id" | "client_op_id">): string {
  return block.client_op_id ?? String(block.id);
}

export function blockDraftFromRow(block: DiaryTextBlock): BlockDraft {
  return {
    id: block.id,
    title: block.title ?? "",
    content: block.content,
    sort_order: block.sort_order,
    client_op_id: block.client_op_id,
    components: block.components ?? [],
    tag_ids: block.tag_ids ?? [],
  };
}

export function entryDraftFromRow(entry: DiaryEntryRow): EntryDraft {
  return {
    blocks: entry.blocks
      .toSorted((a, b) => a.sort_order - b.sort_order || a.id - b.id)
      .map(blockDraftFromRow),
    entryDateLocal: isoToDateLocalValue(entry.entry_at),
    tag_ids: [...(entry.tag_ids ?? [])],
  };
}

function tagIdsEqual(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  const left = [...a].toSorted((x, y) => x - y);
  const right = [...b].toSorted((x, y) => x - y);
  for (let i = 0; i < left.length; i += 1) {
    if (left[i] !== right[i]) return false;
  }
  return true;
}

function blocksEqual(a: BlockDraft[], b: BlockDraft[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    const left = a[i];
    const right = b[i];
    if (!left || !right) return false;
    if (
      left.id !== right.id ||
      left.title !== right.title ||
      left.content !== right.content ||
      left.sort_order !== right.sort_order ||
      !tagIdsEqual(left.tag_ids, right.tag_ids)
    ) {
      return false;
    }
  }
  return true;
}

export function isEntryDraftDirty(draft: EntryDraft, baseline: EntryDraft): boolean {
  return (
    !blocksEqual(draft.blocks, baseline.blocks) ||
    draft.entryDateLocal !== baseline.entryDateLocal ||
    !tagIdsEqual(draft.tag_ids, baseline.tag_ids)
  );
}

export function isEntryDraftEqual(a: EntryDraft, b: EntryDraft): boolean {
  return !isEntryDraftDirty(a, b);
}

export function isEntryMetaDirty(draft: EntryDraft, baseline: EntryDraft): boolean {
  return (
    draft.entryDateLocal !== baseline.entryDateLocal ||
    !tagIdsEqual(draft.tag_ids, baseline.tag_ids)
  );
}
