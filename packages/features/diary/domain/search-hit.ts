import type { DiaryTextBlock } from "./types.ts";

/** 搜索命中块正文截断长度（工具侧 snippet） */
export const DIARY_BLOCK_SNIPPET_MAX = 240;

export function diaryBlockSnippet(content: string, max: number = DIARY_BLOCK_SNIPPET_MAX): string {
  const t = content.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)}…`;
}

/** 将完整 text block 收成搜索摘要（content → snippet） */
export function toDiaryHitBlock(block: DiaryTextBlock): DiaryTextBlock {
  return {
    ...block,
    content: diaryBlockSnippet(block.content),
  };
}

/**
 * 按 parent 分组保序：先出现的日记优先；已入选的 parent 继续追加命中块。
 * parentLimit 限制日记壳数量。
 */
export function groupDiaryBlockHitsByParent(
  blocks: DiaryTextBlock[],
  parentLimit: number,
): { parentId: number; blocks: DiaryTextBlock[] }[] {
  const limit = Math.max(1, parentLimit);
  const groups = new Map<number, DiaryTextBlock[]>();
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
