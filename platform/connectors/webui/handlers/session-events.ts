import { bridgeSessionUpdates } from "@freeanima/platform/sap/stream-bridge";
import { webuiCtx } from "./runtime.ts";

export async function fetchSessionAcpDock(sessionId: string) {
  return webuiCtx().getSessionAcpDock(sessionId);
}

export async function* iterateSessionEvents(
  sessionId: string,
  signal: AbortSignal,
): AsyncGenerator<{ event: string; data: string }> {
  const ctx = webuiCtx();

  yield { event: "ready", data: JSON.stringify({ session_id: sessionId }) };
  for await (const mapped of bridgeSessionUpdates(
    sessionId,
    (cb) => ctx.watchSession(sessionId, cb),
    signal,
  )) {
    if (signal.aborted) break;
    yield {
      event: mapped.method === "session.updated" ? "session_updated" : mapped.method,
      data: JSON.stringify(mapped.payload),
    };
  }
}
