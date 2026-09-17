import { describe, expect, it } from "bun:test";

import type { DiaryEntryRow } from "./format-diary.ts";
import { blockUiKey, entryDraftFromRow, isEntryDraftDirty } from "./entry-draft-dirty.ts";

const baseEntry: DiaryEntryRow = {
  id: 1,
  title: "2026-01-01",
  summary: "",
  entry_at: "2026-01-01T12:00:00+08:00",
  tag_ids: [1, 2],
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

describe("blockUiKey", () => {
  it("优先使用 client_op_id，保存换 id 后仍稳定", () => {
    const op = "op-stable-1";
    expect(blockUiKey({ id: -1, client_op_id: op })).toBe(op);
    expect(blockUiKey({ id: 42, client_op_id: op })).toBe(op);
  });

  it("无 client_op_id 时回退为 id 字符串", () => {
    expect(blockUiKey({ id: 10, client_op_id: null })).toBe("10");
  });
});

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
      tag_ids: [1, 2],
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

  it("条目标签变更时返回 true", () => {
    expect(isEntryDraftDirty({ ...baseline, tag_ids: [2, 1] }, baseline)).toBe(false);
    expect(isEntryDraftDirty({ ...baseline, tag_ids: [1] }, baseline)).toBe(true);
  });
});
