import { describe, expect, test } from "bun:test";
import { isInToolLoop } from "@freeanima/habitat/core/compress/compression-tool-loop.ts";
import type { StoredMessage } from "@freeanima/habitat/core/db/domain";

/**
 * continueTurn 语义守卫：不 rollback 时，工具半截尾巴应仍被 isInToolLoop 识别，
 * 以便 prepare 后从现状续跑（与 retryTurn 的回滚语义对照）。
 */
describe("continueTurn semantics (tool tail)", () => {
  test("user 后仅 tool 链 → isInToolLoop，续跑应保留尾巴", () => {
    const msgs: StoredMessage[] = [
      { role: "user", content: "查一下" },
      {
        role: "assistant",
        content: "",
        tool_calls: [{ id: "c1", type: "function", function: { name: "search", arguments: "{}" } }],
      },
      { role: "tool", tool_call_id: "c1", name: "search", content: '{"ok":true}' },
    ];
    expect(isInToolLoop(msgs)).toBe(true);
  });

  test("仅 user 无尾巴 → 非 tool loop，continue 仍从该 user 续跑", () => {
    const msgs: StoredMessage[] = [{ role: "user", content: "你好" }];
    expect(isInToolLoop(msgs)).toBe(false);
  });
});
