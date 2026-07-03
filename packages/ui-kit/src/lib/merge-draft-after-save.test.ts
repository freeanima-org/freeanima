import { describe, expect, it } from "bun:test";

import { mergeDraftAfterSave } from "./merge-draft-after-save.ts";

type Draft = { text: string };

const equal = (a: Draft, b: Draft) => a.text === b.text;

describe("mergeDraftAfterSave", () => {
  it("保存期间继续编辑时保留当前 draft", () => {
    const savingSnapshot: Draft = { text: "hello" };
    const synced: Draft = { text: "hello" };
    const current: Draft = { text: "hello world" };
    const result = mergeDraftAfterSave({ current, savingSnapshot, synced, isEqual: equal });
    expect(result.draft).toBe(current);
    expect(result.baseline).toBe(synced);
  });

  it("未继续编辑且与服务端一致时保留原引用", () => {
    const savingSnapshot: Draft = { text: "hello" };
    const synced: Draft = { text: "hello" };
    const current = savingSnapshot;
    const result = mergeDraftAfterSave({ current, savingSnapshot, synced, isEqual: equal });
    expect(result.draft).toBe(current);
    expect(result.baseline).toBe(synced);
  });

  it("未继续编辑但服务端归一化不同时采用 synced", () => {
    const savingSnapshot: Draft = { text: "hello" };
    const synced: Draft = { text: "HELLO" };
    const current = savingSnapshot;
    const result = mergeDraftAfterSave({ current, savingSnapshot, synced, isEqual: equal });
    expect(result.draft).toBe(synced);
    expect(result.baseline).toBe(synced);
  });
});
