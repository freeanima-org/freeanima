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
    expect(state.current?.link ?? null).toBeNull();
    expect(state.pending).toBe(1);
  });

  test("bubble 带 link 入队并可前进关闭", async () => {
    const raw = await executeCompanionTool("bubble", {
      text: "任务到期",
      link: "/tasks?list=3&item=7",
    });
    const parsed = JSON.parse(raw) as { ok: boolean; link: { path: string } };
    expect(parsed.ok).toBe(true);
    expect(parsed.link).toEqual({ path: "/tasks?list=3&item=7" });
    expect(bubbleState().current?.link).toEqual({ path: "/tasks?list=3&item=7" });
    advanceBubbleLocal();
    expect(bubbleState().current).toBeNull();
  });

  test("bubble link 非法返回错误且不入队", async () => {
    const raw = await executeCompanionTool("bubble", { text: "x", link: "https://example.com" });
    const parsed = JSON.parse(raw) as { error?: string };
    expect(parsed.error).toContain("link 无效");
    expect(bubbleState().pending).toBe(0);
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
