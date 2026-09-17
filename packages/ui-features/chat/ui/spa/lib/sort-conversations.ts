import type { ConversationListItem } from "./types.ts";

function pinnedAtMs(item: ConversationListItem): number {
  if (!item.pinnedAt) return 0;
  return Date.parse(item.pinnedAt) || 0;
}

/** 侧边栏：置顶优先，再按最近更新（`created` 字段来自 API `updated_at`）。 */
export function sortConversationsByUpdatedAt(
  items: ConversationListItem[],
): ConversationListItem[] {
  return [...items].toSorted((a, b) => {
    const aPinned = a.pinnedAt != null;
    const bPinned = b.pinnedAt != null;
    if (aPinned !== bPinned) return aPinned ? -1 : 1;
    if (aPinned && bPinned) {
      const pa = pinnedAtMs(a);
      const pb = pinnedAtMs(b);
      if (pb !== pa) return pb - pa;
    }
    const ta = Date.parse(a.created) || 0;
    const tb = Date.parse(b.created) || 0;
    if (tb !== ta) return tb - ta;
    return b.id.localeCompare(a.id);
  });
}
