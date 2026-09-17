import type { NoteTextBlock } from "./types.ts";

/** 搜索命中块正文截断长度 */
export const NOTE_BLOCK_SNIPPET_MAX = 240;

export function noteBlockSnippet(content: string, max: number = NOTE_BLOCK_SNIPPET_MAX): string {
  const t = content.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)}…`;
}

export function toNoteHitBlock(block: NoteTextBlock): NoteTextBlock {
  return {
    ...block,
    content: noteBlockSnippet(block.content),
  };
}

/**
 * 按 parent 分组保序：先出现的笔记优先；已入选的 parent 继续追加命中块。
 */
export function groupNoteBlockHitsByParent(
  blocks: NoteTextBlock[],
  parentLimit: number,
): { parentId: number; blocks: NoteTextBlock[] }[] {
  const limit = Math.max(1, parentLimit);
  const groups = new Map<number, NoteTextBlock[]>();
  const order: number[] = [];

  for (const block of blocks) {
    const existing = groups.get(block.parent_id);
    if (existing) {
      existing.push(block);
      continue;
    }
    if (order.length >= limit) continue;
    groups.set(block.parent_id, [block]);
    order.push(block.parent_id);
  }

  return order.map((parentId) => ({
    parentId,
    blocks: groups.get(parentId) ?? [],
  }));
}
