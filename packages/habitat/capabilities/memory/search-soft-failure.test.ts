import { afterAll, afterEach, describe, expect, it, mock } from "bun:test";

import {
  registerSoftFailureNotify,
  unregisterSoftFailureNotify,
} from "@freeanima/habitat/core/soft-failure";

const realConversation = await import("@freeanima/habitat/core/db/pg/conversation");
const conversationOriginal = { ...realConversation };

mock.module("@freeanima/habitat/core/db/pg/conversation", () => ({
  ...conversationOriginal,
  searchMessagesFts: async () => {
    throw new Error("fts boom");
  },
}));

const { searchDialogueOnly } = await import("./search.ts");

afterAll(() => {
  mock.module("@freeanima/habitat/core/db/pg/conversation", () => conversationOriginal);
});

afterEach(() => {
  unregisterSoftFailureNotify();
});

describe("memory search soft failure", () => {
  it("notifies when dialogue FTS throws and returns empty", async () => {
    const refs: string[] = [];
    registerSoftFailureNotify(async (input) => {
      refs.push(input.sourceRef);
      return "notified";
    });

    const results = await searchDialogueOnly("hello");
    expect(results).toEqual([]);
    expect(refs.some((r) => r.startsWith("memory:search_failed:dialogue:"))).toBe(true);
  });
});
