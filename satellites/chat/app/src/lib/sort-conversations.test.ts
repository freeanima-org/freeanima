import { describe, expect, test } from "bun:test";

import type { ConversationListItem } from "./types.ts";
import { sortConversationsByUpdatedAt } from "./sort-conversations.ts";

describe("sortConversationsByUpdatedAt", () => {
  test("orders by updated_at descending", () => {
    const items: ConversationListItem[] = [
      { id: "old", title: "old", created: "2026-01-01T00:00:00.000Z", platform: "chat" },
      { id: "new", title: "new", created: "2026-06-01T00:00:00.000Z", platform: "chat" },
    ];
    expect(sortConversationsByUpdatedAt(items).map((s) => s.id)).toEqual(["new", "old"]);
  });
});
