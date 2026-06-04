import { logSseError } from "@freeanima/legacy-kernel";
import { mapStreamEventToApi } from "../api-mappers";
import { getServiceContext } from "../service-context";
import { resolveSessionPlatform } from "./sessions";

export async function* iterateMessageStream(
  sessionId: string,
  message: string,
  streamPath = "/api/sessions/messages/stream",
): AsyncGenerator<{ event: string; data: string }> {
  const { service } = getServiceContext();
  const platform = await resolveSessionPlatform(sessionId);
  let sawDone = false;
  try {
    for await (const event of service.sendMessageStream(sessionId, message, platform)) {
      const apiEvent = mapStreamEventToApi(event);
      if (apiEvent.event === "error") {
        logSseError(streamPath, apiEvent.data.error, { session_id: sessionId });
      }
      if (apiEvent.event === "done") sawDone = true;
      yield { event: apiEvent.event, data: JSON.stringify(apiEvent.data) };
    }
    if (!sawDone) {
      yield { event: "done", data: JSON.stringify({}) };
    }
  } catch (e) {
    logSseError(streamPath, e, { session_id: sessionId });
    yield { event: "error", data: JSON.stringify({ error: String(e) }) };
    yield { event: "done", data: JSON.stringify({}) };
  }
}

export function createMessageStreamResponse(sessionId: string, message: string): Response {
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      for await (const chunk of iterateMessageStream(sessionId, message)) {
        controller.enqueue(encoder.encode(`event: ${chunk.event}\ndata: ${chunk.data}\n\n`));
      }
      controller.close();
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
