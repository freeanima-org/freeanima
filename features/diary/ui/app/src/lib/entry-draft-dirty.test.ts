import { describe, expect, it } from "bun:test";

import type { DiaryEntryRow } from "./format-diary.ts";
import { entryDraftFromRow, isEntryDraftDirty, parseTagsText } from "./entry-draft-dirty.ts";

const baseEntry: DiaryEntryRow = {
  id: 1,
  title: "2026-01-01",
  summary: "",
  content: "正文",
  entry_at: "2026-01-01T12:00:00+08:00",
  tags: ["a", "b"],
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

describe("entryDraftFromRow", () => {
  it("从条目生成 draft", () => {
    expect(entryDraftFromRow(baseEntry)).toEqual({
      content: "正文",
      entryDateLocal: "2026-01-01",
      tagsText: "a, b",
    });
  });
});

describe("isEntryDraftDirty", () => {
  const baseline = entryDraftFromRow(baseEntry);

  it("未修改时返回 false", () => {
    expect(isEntryDraftDirty({ ...baseline }, baseline)).toBe(false);
  });

  it("正文变更时返回 true", () => {
    expect(isEntryDraftDirty({ ...baseline, content: "新正文" }, baseline)).toBe(true);
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
