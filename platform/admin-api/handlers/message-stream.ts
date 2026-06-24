import { logSseError } from "../api-logging.ts";
import { mapStreamEventToApi } from "../api-mappers.ts";
import { adminCtx } from "./runtime.ts";
import { resolveConversationPlatform } from "./conversations.ts";

export async function* iterateMessageStream(
  conversationId: string,
  message: string,
  streamPath = "/api/conversations/messages/stream",
): AsyncGenerator<{ event: string; data: string }> {
  const platform = await resolveConversationPlatform(conversationId);
  let sawDone = false;
  try {
    for await (const event of adminCtx().sendMessageStream(conversationId, message, platform)) {
      const apiEvent = mapStreamEventToApi(event);
      if (apiEvent.event === "error") {
        logSseError(streamPath, apiEvent.data.error, { conversation_id: conversationId });
      }
      if (apiEvent.event === "done") sawDone = true;
      yield { event: apiEvent.event, data: JSON.stringify(apiEvent.data) };
    }
    if (!sawDone) {
      yield { event: "done", data: JSON.stringify({}) };
    }
  } catch (e) {
    logSseError(streamPath, e, { conversation_id: conversationId });
    yield { event: "error", data: JSON.stringify({ error: String(e) }) };
    yield { event: "done", data: JSON.stringify({}) };
  }
}
