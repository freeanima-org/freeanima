import { describe, expect, it } from "bun:test";

import {
  applyAtMentionInsert,
  buildAtMentionMenuEntries,
  parseAtMentionTrigger,
} from "./at-mention-menu.ts";

describe("parseAtMentionTrigger", () => {
  it("detects bare @", () => {
    expect(parseAtMentionTrigger("hello @", 7)).toEqual({ start: 6, query: "" });
  });

  it("captures query after @", () => {
    expect(parseAtMentionTrigger("见 @灼", 4)).toEqual({ start: 2, query: "灼" });
  });

  it("ignores email-like mid-token @", () => {
    expect(parseAtMentionTrigger("a@b", 3)).toBeNull();
  });

  it("ignores completed mention with space", () => {
    expect(parseAtMentionTrigger("@灼华 你好", 8)).toBeNull();
  });
});

describe("buildAtMentionMenuEntries", () => {
  const candidates = [
    { key: "a1", label: "灼华", insertText: "@灼华 ", description: "Anima" },
    { key: "u1", label: "小草", insertText: "@小草 ", description: "用户" },
  ];

  it("lists all when query empty", () => {
    expect(buildAtMentionMenuEntries("", candidates)).toHaveLength(2);
  });

  it("filters by label", () => {
    expect(buildAtMentionMenuEntries("灼", candidates).map((e) => e.key)).toEqual(["a1"]);
  });
});

describe("applyAtMentionInsert", () => {
  it("replaces from @ to cursor", () => {
    const r = applyAtMentionInsert("见 @灼", 2, 4, "@灼华 ");
    expect(r.next).toBe("见 @灼华 ");
    expect(r.caret).toBe("见 @灼华 ".length);
  });
});
