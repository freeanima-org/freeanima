import { describe, expect, it } from "bun:test";

import {
  DEFAULT_TOOL_DISPLAY_MODE,
  resolveSessionHandoffOnNew,
  resolveToolDisplayMode,
} from "./tool-display.ts";

describe("resolveToolDisplayMode", () => {
  it("defaults to name", () => {
    expect(DEFAULT_TOOL_DISPLAY_MODE).toBe("name");
    expect(resolveToolDisplayMode({}, undefined)).toBe("name");
  });

  it("session override wins over global config", () => {
    expect(
      resolveToolDisplayMode(
        { role: "session_meta", gateway_tool_display: "hidden" } as never,
        { gateway: { tool_display: "count" } } as never,
      ),
    ).toBe("hidden");
  });
});

describe("resolveSessionHandoffOnNew", () => {
  it("uses platform defaults when config unset", () => {
    expect(resolveSessionHandoffOnNew("discord", {} as never)).toBe(true);
    expect(resolveSessionHandoffOnNew("weixin", {} as never)).toBe(false);
  });

  it("respects config override", () => {
    expect(
      resolveSessionHandoffOnNew("weixin", { weixin: { session_handoff_on_new: true } } as never),
    ).toBe(true);
  });
});
