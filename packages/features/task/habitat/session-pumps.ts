let sessionPumps: Map<string, AbortController> | null = null;

/** Called once from platform ws-server when Habitat RPC session handlers are created. */
export function bindTaskSessionPumps(pumps: Map<string, AbortController>): void {
  sessionPumps = pumps;
}

export function taskSessionPumps(): Map<string, AbortController> {
  if (!sessionPumps) {
    throw new Error("Task session pumps not initialized");
  }
  return sessionPumps;
}

/** @internal */
export function setTaskSessionPumpsForTest(pumps: Map<string, AbortController> | null): void {
  sessionPumps = pumps;
}
