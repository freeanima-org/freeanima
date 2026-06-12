import { webuiCtx } from "./runtime.ts";

export async function fetchSessionAcpDock(sessionId: string) {
  return webuiCtx().getSessionAcpDock(sessionId);
}

export async function* iterateSessionEvents(
  sessionId: string,
  signal: AbortSignal,
): AsyncGenerator<{ event: string; data: string }> {
  const ctx = webuiCtx();

  let pending: (() => void) | null = null;
  const wake = (): void => {
    pending?.();
    pending = null;
  };

  const unwatch = ctx.watchSession(sessionId, wake);

  try {
    yield { event: "ready", data: JSON.stringify({ session_id: sessionId }) };
    while (!signal.aborted) {
      await new Promise<void>((resolve) => {
        pending = resolve;
      });
      if (signal.aborted) break;
      yield { event: "session_updated", data: JSON.stringify({ session_id: sessionId }) };
    }
  } finally {
    unwatch();
    pending = null;
  }
}
