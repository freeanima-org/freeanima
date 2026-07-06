let sessionPumps: Map<string, AbortController> | null = null;

/** Called once from platform ws-server when Hub RPC session handlers are created. */
export function bindChatSessionPumps(pumps: Map<string, AbortController>): void {
  sessionPumps = pumps;
}

export function chatSessionPumps(): Map<string, AbortController> {
  if (!sessionPumps) {
    throw new Error("Chat session pumps not initialized");
  }
  return sessionPumps;
}
