import type { ConversationListItem } from "./types.ts";

/** 侧边栏：最近更新的会话排在最前（`created` 字段来自 API `updated_at`）。 */
export function sortConversationsByUpdatedAt(
  items: ConversationListItem[],
): ConversationListItem[] {
  return [...items].sort((a, b) => {
    const ta = Date.parse(a.created) || 0;
    const tb = Date.parse(b.created) || 0;
    if (tb !== ta) return tb - ta;
    return b.id.localeCompare(a.id);
  });
}
