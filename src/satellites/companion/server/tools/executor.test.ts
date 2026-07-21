import { describe, expect, test } from "bun:test";

import { executeCompanionTool } from "./executor.ts";
import { advanceBubble, bubbleState, clearBubbles } from "../runtime-state.ts";
import { addRuntimeExternalListener, type RuntimeWsMessage } from "../runtime-ws.ts";

describe("executeCompanionTool → runtime", () => {
  test("bubble 入队并广播 runtime payload", async () => {
    clearBubbles();
    const seen: RuntimeWsMessage[] = [];
    const unsub = addRuntimeExternalListener((msg) => seen.push(msg));
    try {
      const raw = await executeCompanionTool("bubble", { text: "你好" });
      const parsed = JSON.parse(raw) as { ok: boolean; id: string };
      expect(parsed.ok).toBe(true);
      expect(parsed.id).toBeTruthy();
      expect(bubbleState().current?.text).toBe("你好");
      expect(seen.length).toBeGreaterThanOrEqual(1);
      const last = seen.at(-1)!;
      expect(last.type).toBe("runtime");
      expect(last.bubble.current?.text).toBe("你好");
      expect(last.bubble.pending).toBe(1);
    } finally {
      unsub();
      clearBubbles();
    }
  });

  test("play_slot 广播 play 命令", async () => {
    clearBubbles();
    const seen: RuntimeWsMessage[] = [];
    const unsub = addRuntimeExternalListener((msg) => seen.push(msg));
    try {
      const raw = await executeCompanionTool("play_slot", { slot: "idle" });
      const parsed = JSON.parse(raw) as { ok: boolean; slot: string };
      expect(parsed.ok).toBe(true);
      expect(parsed.slot).toBe("idle");
      const last = seen.at(-1)!;
      expect(last.play).toHaveLength(1);
      expect(last.play[0]?.slot).toBe("idle");
    } finally {
      unsub();
      clearBubbles();
    }
  });

  test("advanceBubble 推进队列", async () => {
    clearBubbles();
    await executeCompanionTool("bubble", { text: "一" });
    await executeCompanionTool("bubble", { text: "二" });
    expect(bubbleState().pending).toBe(2);
    const next = advanceBubble();
    expect(next?.text).toBe("二");
    expect(bubbleState().pending).toBe(1);
    clearBubbles();
  });
});
