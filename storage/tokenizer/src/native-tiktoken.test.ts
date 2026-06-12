import { afterEach, describe, expect, it } from "bun:test";

import { isTiktokenModel, resetTiktokenForTest, tiktokenEncode } from "./native-tiktoken.ts";

describe("isTiktokenModel", () => {
  it("matches gpt models", () => {
    expect(isTiktokenModel("gpt-4o")).toBe(true);
    expect(isTiktokenModel("o1-preview")).toBe(true);
  });

  it("rejects non-gpt models", () => {
    expect(isTiktokenModel("deepseek-v4-flash")).toBe(false);
  });
});

describe("tiktokenEncode", () => {
  afterEach(() => {
    resetTiktokenForTest();
  });

  it("returns token ids for text", () => {
    const ids = tiktokenEncode("hello");
    expect(ids.length).toBeGreaterThan(0);
  });

  it("empty text returns empty", () => {
    expect(tiktokenEncode("")).toEqual([]);
  });
});
