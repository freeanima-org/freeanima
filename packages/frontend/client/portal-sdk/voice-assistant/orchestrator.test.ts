import { describe, expect, test } from "bun:test";

import { getVoiceAssistantSnapshot, resetVoiceAssistant } from "./orchestrator.ts";

describe("getVoiceAssistantSnapshot", () => {
  test("连续读取返回同一引用（useSyncExternalStore 要求）", () => {
    resetVoiceAssistant();
    const a = getVoiceAssistantSnapshot();
    const b = getVoiceAssistantSnapshot();
    expect(a).toBe(b);
  });
});
