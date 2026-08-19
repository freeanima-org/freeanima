import { describe, expect, test } from "bun:test";

import type { ConversationMessage } from "@freeanima/habitat/core/db/domain";

import { filterRecallableMessages } from "./message-filter.ts";

describe("filterRecallableMessages", () => {
  test("只保留 user/assistant，丢 tool/system 与空白", () => {
    const msgs: ConversationMessage[] = [
      { role: "system", content: "sys" },
      { role: "user", content: "  hello  ", timestamp: "t1" },
      { role: "user", content: "   " },
      {
        role: "assistant",
        content: null,
        tool_calls: [{ id: "c1", function: { name: "search", arguments: "{}" } }],
      },
      { role: "assistant", content: "answer", timestamp: "t2" },
      { role: "tool", content: "tool-out", tool_call_id: "c1" },
    ];
    expect(filterRecallableMessages(msgs)).toEqual([
      { t: "t1", role: "user", content: "hello" },
      { t: "t2", role: "assistant", content: "answer" },
    ]);
  });

  test("assistant 无正文且无 tool_calls 也丢弃；缺 timestamp 用空串", () => {
    expect(
      filterRecallableMessages([
        { role: "assistant", content: "" },
        { role: "user", content: "ok" },
      ]),
    ).toEqual([{ t: "", role: "user", content: "ok" }]);
  });
});
