import {
  getSessionPumps,
  setSessionPumpsForTest,
} from "@freeanima/capabilities/ports/session-pumps.ts";

export function chatSessionPumps(): Map<string, AbortController> {
  try {
    return getSessionPumps();
  } catch {
    throw new Error("Chat session pumps not initialized");
  }
}

/** @internal 测试隔离 */
export function setChatSessionPumpsForTest(pumps: Map<string, AbortController> | null): void {
  setSessionPumpsForTest(pumps);
}
