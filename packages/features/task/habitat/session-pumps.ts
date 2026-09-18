import {
  getSessionPumps,
  setSessionPumpsForTest,
} from "@freeanima/capabilities/ports/session-pumps.ts";

export function taskSessionPumps(): Map<string, AbortController> {
  try {
    return getSessionPumps();
  } catch {
    throw new Error("Task session pumps not initialized");
  }
}

/** @internal 测试隔离 */
export function setTaskSessionPumpsForTest(pumps: Map<string, AbortController> | null): void {
  setSessionPumpsForTest(pumps);
}
