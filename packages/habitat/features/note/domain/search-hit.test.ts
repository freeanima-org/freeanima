import { describe, expect, it } from "bun:test";

import {
  NOTE_BLOCK_SNIPPET_MAX,
  groupNoteBlockHitsByParent,
  noteBlockSnippet,
  toNoteHitBlock,
} from "./search-hit.ts";
import type { NoteTextBlock } from "./types.ts";

function block(
  partial: Partial<NoteTextBlock> & Pick<NoteTextBlock, "id" | "parent_id">,
): NoteTextBlock {
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

describe("note search hit helpers", () => {
  it("noteBlockSnippet truncates long content", () => {
    expect(noteBlockSnippet("  short  ")).toBe("short");
    const long = "字".repeat(NOTE_BLOCK_SNIPPET_MAX + 10);
    const snip = noteBlockSnippet(long);
    expect(snip.endsWith("…")).toBe(true);
    expect(snip.length).toBe(NOTE_BLOCK_SNIPPET_MAX + 1);
  });

  it("toNoteHitBlock keeps id/components/parent and snippets content", () => {
    const hit = toNoteHitBlock(
      block({
        id: 7,
        parent_id: 3,
        title: "要点",
        content: "a".repeat(300),
        components: ["content_block"],
      }),
    );
    expect(hit.id).toBe(7);
    expect(hit.parent_id).toBe(3);
    expect(hit.title).toBe("要点");
    expect(hit.components).toEqual(["content_block"]);
    expect(hit.content.length).toBeLessThanOrEqual(NOTE_BLOCK_SNIPPET_MAX + 1);
  });

  it("groupNoteBlockHitsByParent preserves order and appends same-parent hits", () => {
    const groups = groupNoteBlockHitsByParent(
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
