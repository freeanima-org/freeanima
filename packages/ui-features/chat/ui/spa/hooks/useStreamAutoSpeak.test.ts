import { describe, expect, it } from "bun:test";

import { cursorAfterAutoSpeakEnabled } from "./useStreamAutoSpeak.ts";

describe("cursorAfterAutoSpeakEnabled", () => {
  it("流式进行中开启时从文首消费已成句", () => {
    expect(cursorAfterAutoSpeakEnabled(true, 120)).toBe(0);
  });

  it("流已结束时开启不补读，游标落到文末", () => {
    expect(cursorAfterAutoSpeakEnabled(false, 120)).toBe(120);
  });
});
