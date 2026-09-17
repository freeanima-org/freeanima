import { describe, expect, it } from "bun:test";

import { canonicalizeConversationScenario, resolveScenarioProfile } from "./scenario.ts";

describe("canonicalizeConversationScenario", () => {
  it("保留合法值", () => {
    expect(canonicalizeConversationScenario("digital_human")).toBe("digital_human");
    expect(canonicalizeConversationScenario("coding_agent")).toBe("coding_agent");
    expect(canonicalizeConversationScenario("room_inner")).toBe("room_inner");
  });

  it("空 / 非法 → digital_human", () => {
    expect(canonicalizeConversationScenario(null)).toBe("digital_human");
    expect(canonicalizeConversationScenario(undefined)).toBe("digital_human");
    expect(canonicalizeConversationScenario("")).toBe("digital_human");
    expect(canonicalizeConversationScenario("chat")).toBe("digital_human");
    expect(canonicalizeConversationScenario("coding")).toBe("digital_human");
    expect(canonicalizeConversationScenario("work")).toBe("digital_human");
  });
});

describe("resolveScenarioProfile", () => {
  it("coding_agent → prompt work", () => {
    expect(resolveScenarioProfile("coding_agent")).toEqual({ prompt: "work" });
  });

  it("digital_human / room_inner / 缺省 / 非法 → prompt digital_human", () => {
    expect(resolveScenarioProfile("digital_human")).toEqual({ prompt: "digital_human" });
    expect(resolveScenarioProfile("room_inner")).toEqual({ prompt: "digital_human" });
    expect(resolveScenarioProfile(null)).toEqual({ prompt: "digital_human" });
    expect(resolveScenarioProfile(undefined)).toEqual({ prompt: "digital_human" });
    expect(resolveScenarioProfile("")).toEqual({ prompt: "digital_human" });
    expect(resolveScenarioProfile("coding")).toEqual({ prompt: "digital_human" });
  });
});
