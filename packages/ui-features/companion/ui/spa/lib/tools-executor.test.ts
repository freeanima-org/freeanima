import { afterEach, describe, expect, test } from "bun:test";

import { executeCompanionTool } from "./tools-executor.ts";
import { advanceBubbleLocal, bubbleState, clearBubbles } from "./runtime-local.ts";

afterEach(() => {
  clearBubbles();
});

describe("executeCompanionTool → overlay runtime", () => {
  test("bubble 入队", async () => {
    const raw = await executeCompanionTool("bubble", { text: "你好" });
    const parsed = JSON.parse(raw) as { ok: boolean; id: string };
    expect(parsed.ok).toBe(true);
    expect(parsed.id).toMatch(/^bub_/);
    const state = bubbleState();
    expect(state.current?.text).toBe("你好");
    expect(state.pending).toBe(1);
  });

  test("play_slot 返回 ok", async () => {
    const raw = await executeCompanionTool("play_slot", { slot: "idle" });
    const parsed = JSON.parse(raw) as { ok: boolean; slot: string };
    expect(parsed.ok).toBe(true);
    expect(parsed.slot).toBe("idle");
  });

  test("advanceBubbleLocal 切换下一条", async () => {
    await executeCompanionTool("bubble", { text: "一" });
    await executeCompanionTool("bubble", { text: "二" });
    expect(bubbleState().current?.text).toBe("一");
    advanceBubbleLocal();
    expect(bubbleState().current?.text).toBe("二");
  });
});
