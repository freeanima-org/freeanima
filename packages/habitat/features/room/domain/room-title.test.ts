import { describe, expect, it } from "bun:test";

import { formatRoomInnerConversationTitle, isRoomTitlePendingLlm } from "./room-title.ts";

describe("room-title", () => {
  it("占位标题可走 LLM", () => {
    expect(isRoomTitlePendingLlm("")).toBe(true);
    expect(isRoomTitlePendingLlm("新群聊")).toBe(true);
    expect(isRoomTitlePendingLlm("群聊")).toBe(true);
    expect(isRoomTitlePendingLlm("周末讨论")).toBe(false);
  });

  it("内心席标题含群名与 Anima", () => {
    expect(formatRoomInnerConversationTitle("周末讨论", "灼华")).toBe("群聊·周末讨论·灼华");
  });
});
