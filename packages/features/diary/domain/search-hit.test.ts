import { describe, expect, it } from "bun:test";

import { parseDiarySearchComponent } from "./diary-tool-helpers.ts";
import {
  DIARY_BLOCK_SNIPPET_MAX,
  diaryBlockSnippet,
  groupDiaryBlockHitsByParent,
  toDiaryHitBlock,
} from "./search-hit.ts";
import type { DiaryTextBlock } from "./types.ts";

function block(
  partial: Partial<DiaryTextBlock> & Pick<DiaryTextBlock, "id" | "parent_id">,
): DiaryTextBlock {
  return {
    title: "",
    content: "正文",
    sort_order: 0,
    client_op_id: null,

    components: ["content_block"],
    tag_ids: [],
    created_at: "2026-08-14T12:00:00+08:00",
    updated_at: "2026-08-14T12:00:00+08:00",
    ...partial,
  };
}

describe("diary search hit helpers", () => {
  it("parseDiarySearchComponent accepts semantic tags", () => {
    expect(parseDiarySearchComponent("limbic")).toBe("limbic");
    expect(parseDiarySearchComponent("narrative")).toBe("narrative");
    expect(parseDiarySearchComponent("semantic_ref")).toBe("semantic_ref");
    expect(parseDiarySearchComponent("dream")).toBe("dream");
    expect(parseDiarySearchComponent("content_block")).toBeNull();
    expect(parseDiarySearchComponent("")).toBeNull();
  });

  it("diaryBlockSnippet truncates long content", () => {
    expect(diaryBlockSnippet("  short  ")).toBe("short");
    const long = "字".repeat(DIARY_BLOCK_SNIPPET_MAX + 10);
    const snip = diaryBlockSnippet(long);
    expect(snip.endsWith("…")).toBe(true);
    expect(snip.length).toBe(DIARY_BLOCK_SNIPPET_MAX + 1);
  });

  it("toDiaryHitBlock keeps id/components/parent and snippets content", () => {
    const hit = toDiaryHitBlock(
      block({
        id: 7,
        parent_id: 3,
        title: "情绪",
        content: "a".repeat(300),
        components: ["content_block", "limbic"],
      }),
    );
    expect(hit.id).toBe(7);
    expect(hit.parent_id).toBe(3);
    expect(hit.title).toBe("情绪");
    expect(hit.components).toEqual(["content_block", "limbic"]);
    expect(hit.content.length).toBeLessThanOrEqual(DIARY_BLOCK_SNIPPET_MAX + 1);
  });

  it("groupDiaryBlockHitsByParent preserves order and appends same-parent hits", () => {
    const groups = groupDiaryBlockHitsByParent(
      [
        block({ id: 1, parent_id: 10, content: "a" }),
        block({ id: 2, parent_id: 20, content: "b" }),
        block({ id: 3, parent_id: 10, content: "c" }),
        block({ id: 4, parent_id: 30, content: "d" }),
      ],
      2,
    );
    expect(groups.map((g) => g.parentId)).toEqual([10, 20]);
    expect(groups[0]!.blocks.map((b) => b.id)).toEqual([1, 3]);
    expect(groups[1]!.blocks.map((b) => b.id)).toEqual([2]);
  });
});
