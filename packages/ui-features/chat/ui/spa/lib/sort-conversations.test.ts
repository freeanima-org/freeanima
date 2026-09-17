import { describe, expect, it } from "bun:test";

import { sortConversationsByUpdatedAt } from "./sort-conversations.ts";
import type { ConversationListItem } from "./types.ts";

function item(
  partial: Pick<ConversationListItem, "id"> & Partial<ConversationListItem>,
): ConversationListItem {
  return {
    title: partial.title ?? partial.id,
    created: partial.created ?? "2026-01-01T00:00:00.000Z",
    platform: partial.platform ?? "chat",
    archivedAt: partial.archivedAt ?? null,
    pinnedAt: partial.pinnedAt ?? null,
    ...partial,
  };
}

describe("sortConversationsByUpdatedAt", () => {
  it("置顶会话排在未置顶之前", () => {
    const sorted = sortConversationsByUpdatedAt([
      item({ id: "a", created: "2026-01-03T00:00:00.000Z" }),
      item({ id: "b", created: "2026-01-01T00:00:00.000Z", pinnedAt: "2026-01-02T00:00:00.000Z" }),
    ]);
    expect(sorted.map((s) => s.id)).toEqual(["b", "a"]);
  });

  it("多个置顶按 pinnedAt 降序，未置顶按 updated_at 降序", () => {
    const sorted = sortConversationsByUpdatedAt([
      item({ id: "old", created: "2026-01-01T00:00:00.000Z" }),
      item({ id: "new", created: "2026-01-04T00:00:00.000Z" }),
      item({
        id: "pin1",
        created: "2026-01-01T00:00:00.000Z",
        pinnedAt: "2026-01-02T00:00:00.000Z",
      }),
      item({
        id: "pin2",
        created: "2026-01-01T00:00:00.000Z",
        pinnedAt: "2026-01-03T00:00:00.000Z",
      }),
    ]);
    expect(sorted.map((s) => s.id)).toEqual(["pin2", "pin1", "new", "old"]);
  });
});
