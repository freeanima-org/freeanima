import { bridgeSessionUpdates } from "@freeanima/platform/sap/stream-bridge";
import { habitatCtx } from "./runtime.ts";

export async function fetchConversationAcpDock(conversationId: string) {
  return habitatCtx().getConversationAcpDock(conversationId);
}

export async function* iterateConversationEvents(
  conversationId: string,
  signal: AbortSignal,
): AsyncGenerator<{ event: string; data: string }> {
  const ctx = habitatCtx();

  yield { event: "ready", data: JSON.stringify({ conversation_id: conversationId }) };
  for await (const mapped of bridgeSessionUpdates(
    conversationId,
    (cb) => ctx.watchConversation(conversationId, cb),
    signal,
  )) {
    if (signal.aborted) break;
    yield {
      event: mapped.method === "conversation.updated" ? "conversation_updated" : mapped.method,
      data: JSON.stringify(mapped.payload),
    };
  }
}
