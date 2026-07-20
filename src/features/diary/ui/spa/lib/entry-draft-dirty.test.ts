import { describe, expect, it } from "bun:test";

import type { DiaryEntryRow } from "./format-diary.ts";
import { entryDraftFromRow, isEntryDraftDirty, parseTagsText } from "./entry-draft-dirty.ts";

const baseEntry: DiaryEntryRow = {
  id: 1,
  title: "2026-01-01",
  summary: "",
  entry_at: "2026-01-01T12:00:00+08:00",
  tags: ["a", "b"],
  blocks: [
    {
      id: 10,
      title: "小节",
      content: "正文",
      sort_order: 0,
      parent_id: 1,
      client_op_id: null,
      components: ["content_block"],
      tag_ids: [3],
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    },
  ],
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

describe("entryDraftFromRow", () => {
  it("从条目生成 draft", () => {
    expect(entryDraftFromRow(baseEntry)).toEqual({
      blocks: [
        {
          id: 10,
          title: "小节",
          content: "正文",
          sort_order: 0,
          client_op_id: null,
          components: ["content_block"],
          tag_ids: [3],
        },
      ],
      entryDateLocal: "2026-01-01",
      tagsText: "a, b",
    });
  });
});

describe("isEntryDraftDirty", () => {
  const baseline = entryDraftFromRow(baseEntry);

  it("未修改时返回 false", () => {
    expect(isEntryDraftDirty({ ...baseline, blocks: [...baseline.blocks] }, baseline)).toBe(false);
  });

  it("正文块变更时返回 true", () => {
    expect(
      isEntryDraftDirty(
        {
          ...baseline,
          blocks: [{ ...baseline.blocks[0]!, content: "新正文" }],
        },
        baseline,
      ),
    ).toBe(true);
  });

  it("块标题变更时返回 true", () => {
    expect(
      isEntryDraftDirty(
        {
          ...baseline,
          blocks: [{ ...baseline.blocks[0]!, title: "新标题" }],
        },
        baseline,
      ),
    ).toBe(true);
  });

  it("块标签变更时返回 true", () => {
    expect(
      isEntryDraftDirty(
        {
          ...baseline,
          blocks: [{ ...baseline.blocks[0]!, tag_ids: [3, 4] }],
        },
        baseline,
      ),
    ).toBe(true);
  });

  it("日期变更时返回 true", () => {
    expect(isEntryDraftDirty({ ...baseline, entryDateLocal: "2026-01-02" }, baseline)).toBe(true);
  });

  it("标签文案变更时返回 true", () => {
    expect(isEntryDraftDirty({ ...baseline, tagsText: "b, a" }, baseline)).toBe(true);
  });
});

describe("parseTagsText", () => {
  it("解析中英文逗号分隔标签", () => {
    expect(parseTagsText("工作, 紧急，个人")).toEqual(["工作", "紧急", "个人"]);
  });
});
