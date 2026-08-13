import { describe, expect, it } from "bun:test";

import {
  DEFAULT_TOOL_DISPLAY_MODE,
  resolveConversationHandoffOnNew,
  resolveToolDisplayMode,
} from "./tool-display.ts";

describe("resolveToolDisplayMode", () => {
  it("defaults to name", () => {
    expect(DEFAULT_TOOL_DISPLAY_MODE).toBe("name");
    expect(resolveToolDisplayMode({})).toBe("name");
  });

  it("conversation override wins over global config", () => {
    expect(
      resolveToolDisplayMode(
        { model: "m", gateway_tool_display: "hidden" } as never,
        { gateway: { tool_display: "count" } } as never,
      ),
    ).toBe("hidden");
  });
});

describe("resolveConversationHandoffOnNew", () => {
  it("uses platform defaults when config unset", () => {
    expect(resolveConversationHandoffOnNew("discord", {})).toBe(true);
    expect(resolveConversationHandoffOnNew("weixin", {})).toBe(false);
  });

  it("respects config override", () => {
    expect(
      resolveConversationHandoffOnNew("weixin", {
        weixin: { session_handoff_on_new: true },
      }),
    ).toBe(true);
  });
});
