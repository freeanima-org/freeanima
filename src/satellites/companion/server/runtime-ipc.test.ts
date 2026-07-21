import { describe, expect, test } from "bun:test";

import { executeCompanionTool } from "./tools/executor.ts";
import { clearBubbles } from "./runtime-state.ts";
import { addRuntimeExternalListener, type RuntimeWsMessage } from "./runtime-ws.ts";

/**
 * Electron `registerCompanionRuntimeIpc` 将同一 listener 接到 webContents.send。
 * 此处验证 tool → external listener 契约（IPC 桥的输入侧）。
 */
describe("companion runtime external listener (IPC input)", () => {
  test("bubble 经 external listener 送达（模拟 companion:runtime）", async () => {
    clearBubbles();
    const seen: RuntimeWsMessage[] = [];
    const unsub = addRuntimeExternalListener((msg) => seen.push(msg));
    try {
      await executeCompanionTool("bubble", { text: "IPC 气泡" });
      expect(seen.some((m) => m.bubble.current?.text === "IPC 气泡")).toBe(true);
      expect(seen.at(-1)?.type).toBe("runtime");
    } finally {
      unsub();
      clearBubbles();
    }
  });
});
